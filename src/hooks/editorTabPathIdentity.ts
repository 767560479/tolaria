import { notePathsMatch } from '../utils/notePathIdentity'
import type { CachedTabState } from './editorBlockResolution'

type TabLike = { entry: { path: string }; content: string }

export function findTabByNotePath<T extends TabLike>(
  tabs: readonly T[],
  path: string | null | undefined,
): T | undefined {
  if (!path) return undefined
  return tabs.find((tab) => notePathsMatch(tab.entry.path, path))
}

export function tabContentForPath(tabs: readonly TabLike[], path: string): string | undefined {
  return findTabByNotePath(tabs, path)?.content
}

export function cachedTabStateForPath(
  cache: Map<string, CachedTabState>,
  path: string | null | undefined,
): CachedTabState | undefined {
  if (!path) return undefined
  const exact = cache.get(path)
  if (exact) return exact
  for (const [cachedPath, state] of cache) {
    if (notePathsMatch(cachedPath, path)) return state
  }
  return undefined
}

export function deleteCachedTabPathsMatching(
  cache: Map<string, CachedTabState>,
  path: string,
): void {
  for (const cachedPath of [...cache.keys()]) {
    if (notePathsMatch(cachedPath, path)) cache.delete(cachedPath)
  }
}

export function retargetCachedTabPath(
  cache: Map<string, CachedTabState>,
  fromPath: string,
  toPath: string,
): void {
  if (fromPath === toPath) return
  const state = cachedTabStateForPath(cache, fromPath)
  if (!state) return
  deleteCachedTabPathsMatching(cache, fromPath)
  deleteCachedTabPathsMatching(cache, toPath)
  cache.set(toPath, state)
}

export function isNotePathIdentityChange(
  prevPath: string | null | undefined,
  nextPath: string | null | undefined,
): boolean {
  if (!prevPath || !nextPath || prevPath === nextPath) return false
  return notePathsMatch(prevPath, nextPath)
}

export function didActiveNotePathChange(
  prevPath: string | null,
  nextPath: string | null,
): boolean {
  if (prevPath === nextPath) return false
  if (!prevPath || !nextPath) return true
  return !notePathsMatch(prevPath, nextPath)
}
