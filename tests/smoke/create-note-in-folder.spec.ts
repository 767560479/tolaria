import fs from 'fs'
import path from 'path'
import { test, expect, type Page } from '@playwright/test'
import {
  createFixtureVaultCopy,
  openFixtureVaultDesktopHarness,
  removeFixtureVaultCopy,
} from '../helpers/fixtureVault'
import { executeCommand, openCommandPalette } from './helpers'

let tempVaultDir: string

function untitledNotesInProject(): string[] {
  const projectDir = path.join(tempVaultDir, 'project')
  return fs.readdirSync(projectDir).filter((name) => /^untitled-note-\d+(?:-\d+)?\.md$/.test(name))
}

async function expectEditorFocused(page: Page): Promise<void> {
  await expect.poll(async () => page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null
    return Boolean(active?.isContentEditable || active?.closest('[contenteditable="true"]'))
  }), { timeout: 5_000 }).toBe(true)
}

test.beforeEach(async ({ page }) => {
  tempVaultDir = createFixtureVaultCopy()
  await openFixtureVaultDesktopHarness(page, tempVaultDir, {
    folders: [{ children: [], name: 'project', path: 'project' }],
  })
  await expect(page.getByTestId('folder-row:project')).toBeVisible({ timeout: 5_000 })
})

test.afterEach(() => {
  removeFixtureVaultCopy(tempVaultDir)
})

test('creates new notes inside the targeted folder @smoke', async ({ page }) => {
  await page.getByTestId('folder-row:project').click({ button: 'right' })
  await page.getByTestId('create-note-in-folder-menu-item').click()

  await expect.poll(untitledNotesInProject, { timeout: 5_000 }).toHaveLength(1)
  await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 5_000 })
  // Focus must land from the create path — do not click the editor first.
  await expectEditorFocused(page)

  const typedTitle = `Folder create ${Date.now()}`
  await page.keyboard.type(typedTitle)
  await expect(page.getByRole('textbox').last()).toContainText(typedTitle, { timeout: 5_000 })

  // Vault watcher reload can rewrite path separators ~1s after create; the note
  // must stay editable without closing/reopening the tab.
  await page.waitForTimeout(1_200)
  await page.locator('.bn-editor').click()
  await expectEditorFocused(page)
  const typedAfterReload = ` still editable ${Date.now()}`
  await page.keyboard.type(typedAfterReload)
  await expect(page.getByRole('textbox').last()).toContainText(typedAfterReload, { timeout: 5_000 })

  await page.getByTestId('folder-row:project').click()
  await openCommandPalette(page)
  await executeCommand(page, 'Create New Note in Current Folder')

  await expect.poll(untitledNotesInProject, { timeout: 5_000 }).toHaveLength(2)
  for (const filename of untitledNotesInProject()) {
    expect(fs.readFileSync(path.join(tempVaultDir, 'project', filename), 'utf8')).toContain('type: Note')
  }
})
