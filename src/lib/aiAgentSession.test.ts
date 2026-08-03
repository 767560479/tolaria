import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentStatus, AiAgentMessage } from './aiAgentConversation'
import { createMissingModelTarget, type AiModelDefinition, type AiModelProvider, type AiTarget } from './aiTargets'

const {
  buildAgentSystemPromptMock,
  createStreamCallbacksMock,
  formatMessageWithHistoryMock,
  hydrateNoteReferencesMock,
  nextMessageIdMock,
  streamAiModelMock,
  trackEventMock,
  trimHistoryMock,
} = vi.hoisted(() => ({
  buildAgentSystemPromptMock: vi.fn(() => 'SYSTEM'),
  createStreamCallbacksMock: vi.fn(() => ({ stream: 'callbacks' })),
  formatMessageWithHistoryMock: vi.fn((_history: unknown, prompt: string) => `formatted:${prompt}`),
  hydrateNoteReferencesMock: vi.fn(async (references: unknown) => references),
  nextMessageIdMock: vi.fn(),
  streamAiModelMock: vi.fn(async () => {}),
  trackEventMock: vi.fn(),
  trimHistoryMock: vi.fn((history: unknown) => history),
}))

vi.mock('../utils/ai-agent', () => ({
  buildAgentSystemPrompt: buildAgentSystemPromptMock,
}))

vi.mock('../utils/ai-chat', () => ({
  MAX_HISTORY_TOKENS: 100_000,
  formatMessageWithHistory: formatMessageWithHistoryMock,
  nextMessageId: nextMessageIdMock,
  trimHistory: trimHistoryMock,
}))

vi.mock('./aiAgentStreamCallbacks', () => ({
  createStreamCallbacks: createStreamCallbacksMock,
}))

vi.mock('../utils/streamAiModel', () => ({
  streamAiModel: streamAiModelMock,
}))

vi.mock('../utils/ai-reference-content', () => ({
  hydrateNoteReferences: hydrateNoteReferencesMock,
}))

vi.mock('./telemetry', () => ({
  trackEvent: trackEventMock,
}))

import {
  clearAgentConversation,
  sendAgentMessage,
  stopAgentMessage,
  type AiAgentSessionRuntime,
} from './aiAgentSession'

function createRuntime(
  initialMessages: AiAgentMessage[] = [],
  initialStatus: AgentStatus = 'idle',
) {
  let messages = initialMessages
  let status = initialStatus

  const messagesRef = { current: messages }
  const statusRef = { current: status }

  const setMessages = vi.fn((next: AiAgentMessage[] | ((current: AiAgentMessage[]) => AiAgentMessage[])) => {
    messages = typeof next === 'function' ? next(messages) : next
    messagesRef.current = messages
  })
  const setStatus = vi.fn((next: AgentStatus | ((current: AgentStatus) => AgentStatus)) => {
    status = typeof next === 'function' ? next(status) : next
    statusRef.current = status
  })

  const runtime: AiAgentSessionRuntime = {
    setMessages,
    setStatus,
    abortRef: { current: { aborted: true } },
    responseAccRef: { current: 'stale response' },
    fileCallbacksRef: { current: { onVaultChanged: vi.fn() } },
    toolInputMapRef: { current: new Map([['stale-tool', { tool: 'Write', input: '{"path":"/stale.md"}' }]]) },
    messagesRef,
    statusRef,
  }

  return {
    runtime,
    getMessages: () => messages,
    getStatus: () => status,
  }
}

type RuntimeFixture = ReturnType<typeof createRuntime>

const completedHistory: AiAgentMessage = {
  id: 'msg-1',
  userMessage: 'Previous question',
  actions: [],
  response: 'Previous answer',
}
const streamingHistory: AiAgentMessage = {
  id: 'msg-2',
  userMessage: 'Ignored streaming question',
  actions: [],
  isStreaming: true,
}
const expectedChatHistory = [
  { role: 'user', content: 'Previous question', id: 'msg-1' },
  { role: 'assistant', content: 'Previous answer', id: 'msg-1-resp' },
]
const apiModelProvider: AiModelProvider = {
  id: 'openai',
  name: 'OpenAI',
  kind: 'open_ai',
  base_url: 'https://api.openai.com/v1',
  api_key_storage: 'local_file',
  api_key_env_var: null,
  models: [],
}
const apiModel: AiModelDefinition = {
  id: 'gpt-5-nano',
  display_name: 'GPT-5 nano',
  context_window: null,
  max_output_tokens: null,
  capabilities: {
    streaming: false,
    tools: false,
    vision: false,
    json_mode: false,
    reasoning: false,
  },
}
const apiTarget: AiTarget = {
  kind: 'api_model',
  provider: apiModelProvider,
  model: apiModel,
  id: 'model:openai/gpt-5-nano',
  label: 'OpenAI · GPT-5 nano',
  shortLabel: 'GPT-5 nano',
}

function expectStreamingRuntimeState(session: RuntimeFixture): void {
  expect(session.runtime.abortRef.current.aborted).toBe(false)
  expect(session.runtime.abortRef.current.controller).toBeInstanceOf(AbortController)
  expect(session.runtime.responseAccRef.current).toBe('')
  expect(session.runtime.toolInputMapRef.current.size).toBe(0)
  expect(session.getStatus()).toBe('thinking')
  expect(session.getMessages().at(-1)).toEqual({
    userMessage: 'Latest question',
    references: [{ path: '/vault/ref.md', title: 'Ref' }],
    actions: [],
    isStreaming: true,
    id: 'msg-stream',
  })
}

function expectFormattedHistoryUsed(): void {
  expect(trimHistoryMock).toHaveBeenCalledWith(expectedChatHistory, 100_000)
  expect(formatMessageWithHistoryMock).toHaveBeenCalledWith(
    expectedChatHistory,
    expect.stringContaining('Latest question'),
  )
  expect(formatMessageWithHistoryMock).toHaveBeenCalledWith(
    expectedChatHistory,
    expect.stringContaining('/vault/ref.md'),
  )
}

function expectApiModelStreamingRequest(
  runtime: RuntimeFixture['runtime'],
  vaultPaths?: string[],
): void {
  expect(createStreamCallbacksMock).toHaveBeenCalledWith(expect.objectContaining({
    messageId: 'msg-stream',
    vaultPath: '/vault',
    setMessages: runtime.setMessages,
    setStatus: runtime.setStatus,
  }))
  expect(streamAiModelMock).toHaveBeenCalledWith({
    provider: apiModelProvider,
    model: apiModel,
    message: expect.stringContaining('formatted:Latest question'),
    systemPrompt: 'SYSTEM',
    vaultPath: '/vault',
    vaultPaths,
    callbacks: { stream: 'callbacks' },
    signal: expect.any(AbortSignal),
  })
}

describe('aiAgentSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    buildAgentSystemPromptMock.mockReturnValue('SYSTEM')
    createStreamCallbacksMock.mockReturnValue({ stream: 'callbacks' })
    formatMessageWithHistoryMock.mockImplementation((_history: unknown, prompt: string) => `formatted:${prompt}`)
    trimHistoryMock.mockImplementation((history: unknown) => history)
    streamAiModelMock.mockResolvedValue(undefined)
    hydrateNoteReferencesMock.mockImplementation(async (references: unknown) => references)
    trackEventMock.mockClear()
  })

  async function expectLocalResponse(options: {
    messageId: string
    context: {
      agent: 'claude_code' | 'codex' | 'copilot' | 'opencode' | 'pi' | 'antigravity'
      ready: boolean
      vaultPath: string
    }
    prompt: { text: string; references?: [] }
    reason: 'agent_unavailable' | 'missing_vault'
    response: string
  }) {
    nextMessageIdMock.mockReturnValue(options.messageId)
    const { runtime, getMessages } = createRuntime()

    await sendAgentMessage({
      runtime,
      context: options.context,
      prompt: options.prompt,
    })

    expect(getMessages()).toEqual([
      {
        userMessage: options.prompt.text,
        references: undefined,
        actions: [],
        response: options.response,
        id: options.messageId,
      },
    ])
    expect(trackEventMock).toHaveBeenCalledWith('ai_agent_message_blocked', {
      agent: options.context.agent,
      reason: options.reason,
    })
  }

  it('ignores blank prompts and busy runtimes', async () => {
    const idleRuntime = createRuntime()
    await sendAgentMessage({
      runtime: idleRuntime.runtime,
      context: { agent: 'codex', ready: true, vaultPath: '/vault' },
      prompt: { text: '   ' },
    })

    const busyRuntime = createRuntime([], 'thinking')
    await sendAgentMessage({
      runtime: busyRuntime.runtime,
      context: { agent: 'codex', ready: true, vaultPath: '/vault' },
      prompt: { text: 'Question' },
    })

    expect(idleRuntime.getMessages()).toEqual([])
    expect(busyRuntime.getMessages()).toEqual([])
  })

  it('appends local fallback responses when the session cannot stream', async () => {
    const fallbackCases = [
      {
        messageId: 'msg-local',
        context: { agent: 'codex', ready: true, vaultPath: '' },
        prompt: { text: 'Open a note' },
        reason: 'missing_vault',
        response: 'No vault loaded. Open a vault first.',
      },
      {
        messageId: 'msg-missing',
        context: { agent: 'codex', ready: false, vaultPath: '/vault' },
        prompt: { text: 'Open a note', references: [] },
        reason: 'agent_unavailable',
        response: 'No AI model is configured. Add a model provider in Settings.',
      },
    ] as const

    for (const fallbackCase of fallbackCases) {
      await expectLocalResponse(fallbackCase)
    }
  })

  it('starts a streaming session with formatted history and fresh refs', async () => {
    nextMessageIdMock.mockReturnValue('msg-stream')
    const session = createRuntime([
      completedHistory,
      streamingHistory,
    ])

    await sendAgentMessage({
      runtime: session.runtime,
      context: {
        agent: 'codex',
        locale: 'it-IT',
        target: apiTarget,
        ready: true,
        vaultPath: '/vault',
        systemPromptOverride: 'OVERRIDE',
      },
      prompt: {
        text: '  Latest question  ',
        references: [{ path: '/vault/ref.md', title: 'Ref' }],
      },
    })

    expectStreamingRuntimeState(session)
    expect(hydrateNoteReferencesMock).toHaveBeenCalledWith([{ path: '/vault/ref.md', title: 'Ref' }])
    expectFormattedHistoryUsed()
    expect(buildAgentSystemPromptMock).toHaveBeenCalledWith({
      agent: 'codex',
      vaultContext: 'OVERRIDE',
    })
    expectApiModelStreamingRequest(session.runtime)
    expect(trackEventMock).toHaveBeenCalledWith('ai_agent_message_sent', {
      agent: 'codex',
      has_context: 1,
      reference_count: 1,
      history_message_count: 1,
    })
  })

  it('blocks missing model targets without calling stream helpers', async () => {
    nextMessageIdMock.mockReturnValue('msg-stream')
    const session = createRuntime()

    await sendAgentMessage({
      runtime: session.runtime,
      context: {
        agent: 'claude_code',
        target: createMissingModelTarget(),
        ready: true,
        vaultPath: '/vault',
      },
      prompt: { text: 'Use the missing model' },
    })

    expect(streamAiModelMock).not.toHaveBeenCalled()
  })

  it('passes vault roots to api model streams for native note tools', async () => {
    nextMessageIdMock.mockReturnValue('msg-stream')
    const session = createRuntime([
      completedHistory,
      streamingHistory,
    ])

    await sendAgentMessage({
      runtime: session.runtime,
      context: {
        agent: 'codex',
        target: apiTarget,
        ready: true,
        vaultPath: '/vault',
        vaultPaths: ['/vault', '/team-vault'],
      },
      prompt: {
        text: '  Latest question  ',
        references: [{ path: '/vault/ref.md', title: 'Ref' }],
      },
    })

    expectStreamingRuntimeState(session)
    expectFormattedHistoryUsed()
    expectApiModelStreamingRequest(session.runtime, ['/vault', '/team-vault'])
  })

  it('clears the conversation and resets runtime refs', () => {
    const { runtime } = createRuntime([
      { id: 'msg-1', userMessage: 'Question', actions: [] },
    ], 'done')

    clearAgentConversation(runtime)

    expect(runtime.abortRef.current.aborted).toBe(true)
    expect(runtime.responseAccRef.current).toBe('')
    expect(runtime.toolInputMapRef.current.size).toBe(0)
    expect(runtime.setMessages).toHaveBeenCalledWith([])
    expect(runtime.setStatus).toHaveBeenCalledWith('idle')
  })

  it('stops the active stream and marks the streaming message as stopped', async () => {
    nextMessageIdMock.mockReturnValue('msg-stream')
    const session = createRuntime()
    let streamSignal: AbortSignal | undefined
    streamAiModelMock.mockImplementation(async ({ signal }: { signal?: AbortSignal }) => new Promise<void>((resolve) => {
      streamSignal = signal
      signal?.addEventListener('abort', () => resolve(), { once: true })
    }))

    const pending = sendAgentMessage({
      runtime: session.runtime,
      context: {
        agent: 'codex',
        target: apiTarget,
        ready: true,
        vaultPath: '/vault',
      },
      prompt: { text: '  Latest question  ' },
    })
    await Promise.resolve()
    await Promise.resolve()

    stopAgentMessage(session.runtime, { agent: 'codex', locale: 'en' })
    await pending

    expect(streamSignal?.aborted).toBe(true)
    expect(session.runtime.abortRef.current.aborted).toBe(true)
    expect(session.getStatus()).toBe('idle')
    expect(session.getMessages()).toEqual([{
      userMessage: 'Latest question',
      actions: [],
      isStreaming: false,
      reasoningDone: true,
      response: 'Stopped.',
      id: 'msg-stream',
    }])
    expect(trackEventMock).toHaveBeenCalledWith('ai_agent_response_stopped', {
      agent: 'codex',
      had_partial_response: 0,
      tool_count: 0,
    })
  })
})
