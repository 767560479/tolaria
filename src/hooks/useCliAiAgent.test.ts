import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCliAiAgent } from './useCliAiAgent'
import { streamAiModel } from '../utils/streamAiModel'
import { buildAgentSystemPrompt } from '../utils/ai-agent'
import { getAgentDocsPath } from '../lib/agentDocsPath'
import type { AiTarget } from '../lib/aiTargets'
import {
  cloneAiWorkspaceSessionUntilMessage,
  resetAiWorkspaceSessionStoreForTests,
} from '../lib/aiWorkspaceSessionStore'

vi.mock('../utils/streamAiModel', () => ({
  streamAiModel: vi.fn(),
}))

vi.mock('../utils/ai-agent', () => ({
  buildAgentSystemPrompt: vi.fn(() => 'default-system-prompt'),
}))

vi.mock('../lib/agentDocsPath', () => ({
  getAgentDocsPath: vi.fn(),
}))

const mockStreamAiModel = vi.mocked(streamAiModel)
const mockBuildAgentSystemPrompt = vi.mocked(buildAgentSystemPrompt)
const mockGetAgentDocsPath = vi.mocked(getAgentDocsPath)
const VAULT = '/Users/luca/Laputa'
const apiTarget: AiTarget = {
  kind: 'api_model',
  provider: {
    id: 'openai',
    name: 'OpenAI',
    kind: 'open_ai',
    base_url: 'https://api.openai.com/v1',
    api_key_storage: 'local_file',
    api_key_env_var: null,
    models: [],
  },
  model: {
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
  },
  id: 'model:openai/gpt-5-nano',
  label: 'OpenAI · GPT-5 nano',
  shortLabel: 'GPT-5 nano',
}

function renderAgent(
  contextPrompt: string | undefined = undefined,
  sessionId?: string,
) {
  return renderHook(
    ({ context }) => useCliAiAgent(VAULT, [VAULT, '/Users/luca/Brian'], context, undefined, {
      agent: 'codex',
      agentReady: true,
      target: apiTarget,
      sessionId,
    }),
    { initialProps: { context: contextPrompt } },
  )
}

describe('useCliAiAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAgentDocsPath.mockResolvedValue('/app/agent-docs')
    resetAiWorkspaceSessionStoreForTests()
    mockStreamAiModel.mockImplementation(async ({ callbacks }) => {
      callbacks.onText('reply')
      callbacks.onDone()
    })
  })

  it('uses the latest context prompt when sending a message', async () => {
    const { result, rerender } = renderAgent()
    const firstSendMessage = result.current.sendMessage

    rerender({ context: 'You are viewing note with body: Hello world' })

    await act(async () => {
      await result.current.sendMessage('What does this note contain?')
    })

    expect(result.current.sendMessage).not.toBe(firstSendMessage)
    expect(mockBuildAgentSystemPrompt).toHaveBeenCalledWith({
      agent: 'codex',
      agentDocsPath: '/app/agent-docs',
      vaultPaths: [VAULT, '/Users/luca/Brian'],
      vaultContext: 'You are viewing note with body: Hello world',
    })
    expect(mockStreamAiModel).toHaveBeenCalledWith(expect.objectContaining({
      systemPrompt: 'default-system-prompt',
    }))
  })

  it('forwards active vault roots to the stream request', async () => {
    const { result } = renderAgent()

    await act(async () => {
      await result.current.sendMessage('Search all active vaults')
    })

    expect(mockStreamAiModel).toHaveBeenCalledWith(expect.objectContaining({
      vaultPath: VAULT,
      vaultPaths: [VAULT, '/Users/luca/Brian'],
    }))
  })

  it('adds local transcript markers without sending them as chat history', async () => {
    const { result } = renderAgent()

    act(() => {
      result.current.addLocalMarker('AI permission mode changed to Power User. It will apply to the next message.')
    })

    await act(async () => {
      await result.current.sendMessage('Continue')
    })

    expect(result.current.messages[0]).toEqual(expect.objectContaining({
      localMarker: 'AI permission mode changed to Power User. It will apply to the next message.',
    }))
    expect(mockStreamAiModel).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('Continue'),
    }))
  })

  it('embeds completed conversation history and clears it for a fresh chat', async () => {
    let responseNumber = 0
    mockStreamAiModel.mockImplementation(async ({ callbacks }) => {
      responseNumber += 1
      callbacks.onText(`Response ${responseNumber}`)
      callbacks.onDone()
    })

    const { result } = renderAgent()

    await act(async () => {
      await result.current.sendMessage('First question')
    })
    await act(async () => {
      await result.current.sendMessage('Follow-up question')
    })

    expect(mockStreamAiModel).toHaveBeenLastCalledWith(expect.objectContaining({
      message: expect.stringContaining('Follow-up question'),
    }))

    act(() => {
      result.current.clearConversation()
    })

    expect(result.current.messages).toEqual([])
  })

  it('shares session state when a session id is provided', async () => {
    const sessionId = 'shared-session'
    const { result: first } = renderAgent(undefined, sessionId)
    const { result: second } = renderAgent(undefined, sessionId)

    await act(async () => {
      await first.current.sendMessage('Shared prompt')
    })

    expect(second.current.messages).toEqual(first.current.messages)
    expect(cloneAiWorkspaceSessionUntilMessage(sessionId, 'forked', 'missing')).toBeUndefined()
  })
})
