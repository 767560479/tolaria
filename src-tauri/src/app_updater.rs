use serde::{Deserialize, Serialize};
use std::time::Duration;

const GITHUB_RELEASES_API_URL: &str =
    "https://api.github.com/repos/767560479/tolaria/releases?per_page=20";
pub const RELEASES_PAGE_URL: &str = "https://github.com/767560479/tolaria/releases";
const UPDATER_HTTP_TIMEOUT: Duration = Duration::from_secs(5);
const UPDATER_USER_AGENT: &str = concat!("Tolaria/", env!("CARGO_PKG_VERSION"));

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateMetadata {
    pub current_version: String,
    pub version: String,
    pub date: Option<String>,
    pub body: Option<String>,
    pub html_url: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
struct ReleaseVersion {
    year: i32,
    month: u32,
    day: u32,
    sequence: u32,
}

#[derive(Debug, Clone, Deserialize)]
struct GitHubRelease {
    tag_name: String,
    draft: bool,
    html_url: String,
    body: Option<String>,
    published_at: Option<String>,
}

impl ReleaseVersion {
    fn parse_tag(tag_name: &str) -> Option<Self> {
        let release = tag_name.strip_prefix("alpha-v")?;
        let (date, sequence) = release.split_once("-alpha.")?;
        let sequence = sequence.parse().ok()?;
        let (year, month, day) = parse_calendar_date(date)?;
        chrono::NaiveDate::from_ymd_opt(year, month, day)?;

        Some(Self {
            year,
            month,
            day,
            sequence,
        })
    }

    fn parse_version(version: &str) -> Option<Self> {
        let trimmed = version.trim();
        let base = trimmed.split('+').next()?.trim();
        if let Some(parsed) = Self::parse_tag(base) {
            return Some(parsed);
        }

        let (calendar, sequence) = match base.split_once("-alpha.") {
            Some((calendar, sequence)) => (calendar, sequence.parse().ok()?),
            None => (base, 0),
        };
        let (year, month, day) = parse_calendar_date(calendar)?;
        chrono::NaiveDate::from_ymd_opt(year, month, day)?;

        Some(Self {
            year,
            month,
            day,
            sequence,
        })
    }

    fn to_version_string(self) -> String {
        if self.sequence == 0 {
            format!("{}.{}.{}", self.year, self.month, self.day)
        } else {
            format!(
                "{}.{}.{}-alpha.{}",
                self.year, self.month, self.day, self.sequence
            )
        }
    }
}

fn parse_calendar_date(value: &str) -> Option<(i32, u32, u32)> {
    let mut parts = value.split('.');
    let year = parts.next()?.parse().ok()?;
    let month = parts.next()?.parse().ok()?;
    let day = parts.next()?.parse().ok()?;
    if parts.next().is_some() {
        return None;
    }

    Some((year, month, day))
}

fn current_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

fn newest_release(releases: &[GitHubRelease]) -> Option<(ReleaseVersion, &GitHubRelease)> {
    releases
        .iter()
        .filter(|release| !release.draft)
        .filter_map(|release| {
            ReleaseVersion::parse_tag(&release.tag_name).map(|version| (version, release))
        })
        .max_by_key(|(version, _)| *version)
}

fn update_from_release(
    current_version: &str,
    release: &GitHubRelease,
    remote_version: ReleaseVersion,
) -> Option<AppUpdateMetadata> {
    let current = ReleaseVersion::parse_version(current_version)?;
    if remote_version <= current {
        return None;
    }

    Some(AppUpdateMetadata {
        current_version: current_version.to_string(),
        version: remote_version.to_version_string(),
        date: release.published_at.clone(),
        body: release.body.clone(),
        html_url: if release.html_url.trim().is_empty() {
            RELEASES_PAGE_URL.to_string()
        } else {
            release.html_url.clone()
        },
    })
}

async fn fetch_github_releases() -> Result<Vec<GitHubRelease>, String> {
    let client = reqwest::Client::builder()
        .timeout(UPDATER_HTTP_TIMEOUT)
        .user_agent(UPDATER_USER_AGENT)
        .build()
        .map_err(|e| format!("Failed to create GitHub releases client: {e}"))?;

    client
        .get(GITHUB_RELEASES_API_URL)
        .header(reqwest::header::ACCEPT, "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch GitHub releases: {e}"))?
        .error_for_status()
        .map_err(|e| format!("GitHub releases request failed: {e}"))?
        .json::<Vec<GitHubRelease>>()
        .await
        .map_err(|e| format!("Failed to parse GitHub releases: {e}"))
}

pub async fn check_for_app_update() -> Result<Option<AppUpdateMetadata>, String> {
    let releases = fetch_github_releases().await?;
    let Some((remote_version, release)) = newest_release(&releases) else {
        return Ok(None);
    };

    let current_version = current_app_version();
    Ok(update_from_release(
        &current_version,
        release,
        remote_version,
    ))
}

#[cfg(test)]
mod tests {
    use super::{
        newest_release, update_from_release, AppUpdateMetadata, GitHubRelease, ReleaseVersion,
        RELEASES_PAGE_URL,
    };
    use serde_json::json;

    #[test]
    fn parse_tag_reads_padded_alpha_sequence() {
        assert_eq!(
            ReleaseVersion::parse_tag("alpha-v2026.5.8-alpha.0017"),
            Some(ReleaseVersion {
                year: 2026,
                month: 5,
                day: 8,
                sequence: 17,
            })
        );
    }

    #[test]
    fn parse_version_reads_cargo_style_alpha() {
        assert_eq!(
            ReleaseVersion::parse_version("2026.5.8-alpha.17"),
            Some(ReleaseVersion {
                year: 2026,
                month: 5,
                day: 8,
                sequence: 17,
            })
        );
    }

    #[test]
    fn newest_release_skips_drafts_and_picks_highest_sequence() {
        let releases = vec![
            GitHubRelease {
                tag_name: "alpha-v2026.5.8-alpha.0007".into(),
                draft: false,
                html_url: "https://example.com/7".into(),
                body: None,
                published_at: None,
            },
            GitHubRelease {
                tag_name: "alpha-v2026.5.8-alpha.0018".into(),
                draft: true,
                html_url: "https://example.com/draft".into(),
                body: None,
                published_at: None,
            },
            GitHubRelease {
                tag_name: "alpha-v2026.5.8-alpha.0017".into(),
                draft: false,
                html_url: "https://example.com/17".into(),
                body: Some("notes".into()),
                published_at: Some("2026-05-08T12:00:00Z".into()),
            },
        ];

        let (version, release) = newest_release(&releases).unwrap();
        assert_eq!(version.sequence, 17);
        assert_eq!(release.html_url, "https://example.com/17");
    }

    #[test]
    fn update_from_release_returns_none_when_not_newer() {
        let release = GitHubRelease {
            tag_name: "alpha-v2026.5.8-alpha.0017".into(),
            draft: false,
            html_url: "https://example.com/17".into(),
            body: None,
            published_at: None,
        };
        let remote = ReleaseVersion::parse_tag(&release.tag_name).unwrap();
        assert!(update_from_release("2026.5.8-alpha.17", &release, remote).is_none());
        assert!(update_from_release("2026.5.8-alpha.18", &release, remote).is_none());
    }

    #[test]
    fn update_from_release_returns_metadata_when_newer() {
        let release = GitHubRelease {
            tag_name: "alpha-v2026.5.8-alpha.0017".into(),
            draft: false,
            html_url: "https://example.com/17".into(),
            body: Some("Bug fixes".into()),
            published_at: Some("2026-05-08T12:00:00Z".into()),
        };
        let remote = ReleaseVersion::parse_tag(&release.tag_name).unwrap();
        let metadata = update_from_release("2026.5.8-alpha.7", &release, remote).unwrap();
        assert_eq!(metadata.version, "2026.5.8-alpha.17");
        assert_eq!(metadata.html_url, "https://example.com/17");
        assert_eq!(metadata.body.as_deref(), Some("Bug fixes"));
    }

    #[test]
    fn update_metadata_serializes_for_frontend_consumers() {
        let metadata = AppUpdateMetadata {
            current_version: "2026.4.1".into(),
            version: "2026.4.2-alpha.1".into(),
            date: Some("2026-04-30T12:00:00Z".into()),
            body: Some("Bug fixes".into()),
            html_url: RELEASES_PAGE_URL.into(),
        };

        assert_eq!(
            serde_json::to_value(metadata).unwrap(),
            json!({
                "currentVersion": "2026.4.1",
                "version": "2026.4.2-alpha.1",
                "date": "2026-04-30T12:00:00Z",
                "body": "Bug fixes",
                "htmlUrl": RELEASES_PAGE_URL,
            })
        );
    }
}
