import type { AiAgentId } from '../lib/aiAgents'

/**
 * AI system prompt helpers for in-app direct model chat.
 */

interface AgentSystemPromptOptions {
  vaultContext?: string
  agentDocsPath?: string
  agent?: AiAgentId
  vaultPaths?: string[]
}

function normalizePromptOptions(
  options?: string | AgentSystemPromptOptions,
): AgentSystemPromptOptions {
  return typeof options === 'string' ? { vaultContext: options } : options ?? {}
}

function agentDocsInstructions(agentDocsPath: string | undefined): string {
  if (!agentDocsPath) {
    return `Read the vault's AGENTS.md when one exists before making vault-specific assumptions.`
  }

  return `Read the vault's AGENTS.md when one exists before making vault-specific assumptions.
For Tolaria product behavior, workflows, and user questions about how Tolaria works, search the bundled local docs at:
${agentDocsPath}

Start with ${agentDocsPath}/index.md, then use the available file and search tools for specific concepts. Prefer bundled docs over guesses for Tolaria behavior.

When the user asks how to improve a knowledge base, make it better organized, choose better types, model relationships, or make the vault easier for humans and agents to use, treat Portent as Tolaria's default best-practice model. Read ${agentDocsPath}/pages/templates/portent.md and combine it with Tolaria concepts for types, relationships, properties, Inbox, archive, and custom views.`
}

function vaultScopeInstructions(vaultPaths?: string[]): string {
  const roots = (vaultPaths ?? []).map((path) => path.trim()).filter(Boolean)
  if (roots.length <= 1) {
    return `You can edit markdown files in the active vault. Keep file operations scoped to that vault unless the user explicitly gives another path.`
  }

  return [
    `Multiple Tolaria vaults are active. You can read and edit markdown files in these vault roots:`,
    roots.map((path) => `- ${path}`).join('\n'),
    `When using Tolaria MCP tools, pass the target vault path when a relative note path could be ambiguous.`,
  ].join('\n')
}

const AGENT_SYSTEM_PREAMBLE = `You are working inside Tolaria, a local-first Markdown knowledge base.

Notes are Markdown files with YAML frontmatter. Organization is primarily expressed through H1 titles, types, properties, wikilinks, and relationships, not folder structure.
Prefer file edit tools for note changes.
Use the provided MCP tools for: full-text search (search_notes), vault orientation (get_vault_context), parsed note reading (get_note), and opening notes in the UI (open_note).
Use create_note(path, content, vaultPath?) for new Markdown notes when shell writes are unavailable.

When you create or edit a note, call open_note(path) so the user sees it in Tolaria.
When you mention or reference a note by name, always use [[Note Title]] wikilink syntax so the user can click to open it.
Be concise and helpful. When you've completed a task, briefly summarize what you did.`

export function buildAgentSystemPrompt(options?: string | AgentSystemPromptOptions): string {
  const { vaultContext, agentDocsPath, vaultPaths } = normalizePromptOptions(options)
  const prompt = [
    AGENT_SYSTEM_PREAMBLE,
    vaultScopeInstructions(vaultPaths),
    agentDocsInstructions(agentDocsPath),
  ].join('\n\n')

  if (!vaultContext) return prompt
  return `${prompt}\n\nVault context:\n${vaultContext}`
}
