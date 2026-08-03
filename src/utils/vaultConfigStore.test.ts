import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VaultConfig } from '../types'
import {
  bindVaultConfigStore,
  getVaultConfig,
  resetVaultConfigStore,
  updateVaultConfigField,
} from './vaultConfigStore'

function vaultConfig(overrides: Partial<VaultConfig> = {}): VaultConfig {
  return {
    zoom: null,
    view_mode: null,
    editor_mode: null,
    note_layout: null,
    tag_colors: null,
    status_colors: null,
    property_display_modes: null,
    inbox: null,
    allNotes: null,
    ...overrides,
  }
}

describe('vaultConfigStore', () => {
  beforeEach(() => {
    resetVaultConfigStore()
  })

  it('normalizes git setup preference to prompt unless never', () => {
    bindVaultConfigStore(vaultConfig(), vi.fn())
    expect(getVaultConfig().git_setup_preference).toBe('prompt')

    bindVaultConfigStore(vaultConfig({ git_setup_preference: 'never' }), vi.fn())
    expect(getVaultConfig().git_setup_preference).toBe('never')
  })

  it('persists vault config updates', () => {
    const save = vi.fn()
    bindVaultConfigStore(vaultConfig(), save)

    updateVaultConfigField('git_setup_preference', 'never')
    expect(getVaultConfig().git_setup_preference).toBe('never')
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({
      git_setup_preference: 'never',
    }))
  })
})
