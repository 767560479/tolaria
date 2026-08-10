import { useEffect } from 'react'
import { notePathsMatch } from '../utils/notePathIdentity'
import { focusEditorWithRetries, type FocusableEditor } from './editorFocusUtils'
import { resumeEditorFocus } from './editorFocusOwnership'

const TAB_SWAP_EVENT_NAME = 'laputa:editor-tab-swapped'
const FOCUS_EVENT_NAME = 'laputa:focus-editor'
const SWAP_WAIT_FALLBACK_MS = 250
const FOCUS_STABILITY_CHECK_DELAYS_MS = [160, 500, 1_000, 2_000, 4_000] as const

export interface FocusEventDetail {
  t0?: number
  selectTitle?: boolean
  path?: string | null
}

interface PendingFocusRequest {
  id: number
  detail: FocusEventDetail
}

const PENDING_FOCUS_TTL_MS = 6_000
let nextFocusRequestId = 0
let pendingFocusRequest: PendingFocusRequest | null = null
let pendingFocusDispatchTimer: number | null = null

function pendingFocusMatchesPath(path: string): boolean {
  return notePathsMatch(pendingFocusRequest?.detail.path, path)
}

function rememberPendingFocusRequest(detail: FocusEventDetail): PendingFocusRequest | null {
  if (!detail.path) return null
  const request = { id: ++nextFocusRequestId, detail }
  pendingFocusRequest = request
  window.setTimeout(() => {
    if (pendingFocusRequest?.id === request.id) pendingFocusRequest = null
  }, PENDING_FOCUS_TTL_MS)
  return request
}

function clearPendingFocusRequest(path: string): void {
  if (pendingFocusMatchesPath(path)) pendingFocusRequest = null
}

export function requestEditorFocus(detail: FocusEventDetail): void {
  rememberPendingFocusRequest(detail)
  if (pendingFocusDispatchTimer !== null) window.clearTimeout(pendingFocusDispatchTimer)
  pendingFocusDispatchTimer = window.setTimeout(() => {
    pendingFocusDispatchTimer = null
    window.dispatchEvent(new CustomEvent(FOCUS_EVENT_NAME, { detail }))
  }, 0)
}

/** @internal Clears module-level pending focus state between Vitest cases. */
export function resetEditorFocusTestState(): void {
  pendingFocusRequest = null
  if (pendingFocusDispatchTimer !== null) {
    window.clearTimeout(pendingFocusDispatchTimer)
    pendingFocusDispatchTimer = null
  }
}

interface EditorFocusContext {
  editor: FocusableEditor,
  editorMountedRef: React.RefObject<boolean>,
  selectTitle: boolean,
  t0: number | undefined,
}

function scheduleEditorFocus(context: EditorFocusContext, onFocused?: () => void): void {
  const { editor, editorMountedRef, selectTitle, t0 } = context
  const focus = () => {
    focusEditorWithRetries(editor, selectTitle, t0)
    if (editorHasFocus()) onFocused?.()
  }
  if (editorMountedRef.current) {
    requestAnimationFrame(focus)
    return
  }
  setTimeout(focus, 80)
}

function editorHasFocus(): boolean {
  const activeElement = document.activeElement
  return activeElement instanceof Element
    && (Reflect.get(activeElement, 'isContentEditable') === true
      || activeElement.closest('[contenteditable="true"]') !== null)
}

interface FocusStabilityOptions {
  context: EditorFocusContext
  targetPath: string
  pendingCleanups: Set<() => void>
}

function scheduleFocusStabilityChecks(options: FocusStabilityOptions): void {
  const { context, targetPath, pendingCleanups } = options
  for (const delay of FOCUS_STABILITY_CHECK_DELAYS_MS) {
    let timeoutId = 0
    const cleanup = () => {
      window.clearTimeout(timeoutId)
      pendingCleanups.delete(cleanup)
    }
    timeoutId = window.setTimeout(() => {
      pendingCleanups.delete(cleanup)
      if (editorHasFocus()) {
        clearPendingFocusRequest(targetPath)
        return
      }
      // Path-targeted creates often leave focus on the sidebar control that launched
      // them; reclaim whenever the editor is not the active editable.
      resumeEditorFocus()
      focusEditorWithRetries(context.editor, context.selectTitle, context.t0)
      if (editorHasFocus()) clearPendingFocusRequest(targetPath)
    }, delay)
    pendingCleanups.add(cleanup)
  }
}

interface TargetFocusOptions {
  context: EditorFocusContext
  detail: FocusEventDetail
  targetPath: string
  pendingCleanups: Set<() => void>
}

function applyPathTargetedFocus(
  context: EditorFocusContext,
  targetPath: string,
  pendingCleanups: Set<() => void>,
  swapConfirmed: boolean,
): void {
  // Before the matching tab swap, an existing contenteditable focus usually belongs
  // to the previous note — keep the pending request and wait for the real swap.
  if (!swapConfirmed && editorHasFocus()) return

  resumeEditorFocus()
  scheduleEditorFocus(context, () => {
    if (swapConfirmed) clearPendingFocusRequest(targetPath)
  })
  if (swapConfirmed) {
    scheduleFocusStabilityChecks({ context, targetPath, pendingCleanups })
  }
}

function handleTargetFocusRequest(options: TargetFocusOptions): void {
  const { context, detail, targetPath, pendingCleanups } = options
  if (!pendingFocusMatchesPath(targetPath)) rememberPendingFocusRequest(detail)
  // A newer path-targeted request supersedes any in-flight swap waiter / stability checks.
  for (const cleanup of [...pendingCleanups]) cleanup()
  pendingCleanups.clear()
  registerPendingTabFocus({
    targetPath,
    pendingCleanups,
    onSwap: () => applyPathTargetedFocus(context, targetPath, pendingCleanups, true),
    onFallback: () => applyPathTargetedFocus(context, targetPath, pendingCleanups, false),
  })
}

interface PendingTabFocusOptions {
  targetPath: string
  onSwap: () => void
  onFallback: () => void
  pendingCleanups: Set<() => void>
}

function registerPendingTabFocus(options: PendingTabFocusOptions): void {
  const { targetPath, onSwap, onFallback, pendingCleanups } = options
  let settled = false

  const settle = () => {
    if (settled) return
    settled = true
    window.clearTimeout(fallbackTimer)
    window.removeEventListener(TAB_SWAP_EVENT_NAME, handleTabSwap)
    pendingCleanups.delete(cleanupPending)
  }

  const handleTabSwap = (event: Event) => {
    const swapPath = (event as CustomEvent).detail?.path
    if (!notePathsMatch(swapPath, targetPath)) return
    settle()
    onSwap()
  }

  // Keep listening for the real swap after fallback — early focus must not cancel it.
  const fallbackTimer = window.setTimeout(() => {
    onFallback()
  }, SWAP_WAIT_FALLBACK_MS)

  const cleanupPending = () => settle()

  pendingCleanups.add(cleanupPending)
  window.addEventListener(TAB_SWAP_EVENT_NAME, handleTabSwap)
}

/**
 * Focus editor when a new note is created (signaled via custom event).
 * Uses adaptive timing: fast rAF path when editor is already mounted,
 * short timeout when waiting for first mount.
 * When selectTitle is true, also selects all text in the first H1 block.
 */
export function useEditorFocus(
  editor: FocusableEditor,
  editorMountedRef: React.RefObject<boolean>,
) {
  useEffect(() => {
    const pendingCleanups = new Set<() => void>()

    const handleFocusRequest = (detail: FocusEventDetail | undefined) => {
      const t0 = detail?.t0
      const selectTitle = detail?.selectTitle ?? false
      const targetPath = detail?.path ?? null
      const context = { editor, editorMountedRef, selectTitle, t0 }

      if (!targetPath) {
        scheduleEditorFocus(context)
        return
      }
      handleTargetFocusRequest({ context, detail: detail ?? {}, targetPath, pendingCleanups })
    }

    const handler = (e: Event) => {
      handleFocusRequest((e as CustomEvent).detail as FocusEventDetail | undefined)
    }

    window.addEventListener(FOCUS_EVENT_NAME, handler)
    if (pendingFocusRequest) handleFocusRequest(pendingFocusRequest.detail)
    return () => {
      window.removeEventListener(FOCUS_EVENT_NAME, handler)
      for (const cleanup of pendingCleanups) {
        cleanup()
      }
      pendingCleanups.clear()
    }
  }, [editor, editorMountedRef])
}
