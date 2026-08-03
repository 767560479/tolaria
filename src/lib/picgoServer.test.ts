import { describe, expect, it } from 'vitest'
import {
  imageUploadDestinationFromSettings,
  normalizePicgoServerToken,
  normalizePicgoServerUrl,
} from './picgoServer'

describe('normalizePicgoServerUrl', () => {
  it('returns null for empty or whitespace', () => {
    expect(normalizePicgoServerUrl(null)).toBeNull()
    expect(normalizePicgoServerUrl('')).toBeNull()
    expect(normalizePicgoServerUrl('   ')).toBeNull()
  })

  it('rejects non-http(s) schemes', () => {
    expect(normalizePicgoServerUrl('ftp://example.com/upload')).toBeNull()
    expect(normalizePicgoServerUrl('file:///tmp/upload')).toBeNull()
    expect(normalizePicgoServerUrl('not a url')).toBeNull()
  })

  it('keeps trimmed http(s) URLs', () => {
    expect(normalizePicgoServerUrl('  http://127.0.0.1:36677/upload  ')).toBe(
      'http://127.0.0.1:36677/upload',
    )
    expect(normalizePicgoServerUrl('https://pic.example.com/upload')).toBe(
      'https://pic.example.com/upload',
    )
  })
})

describe('normalizePicgoServerToken', () => {
  it('trims and drops empty tokens', () => {
    expect(normalizePicgoServerToken(null)).toBeNull()
    expect(normalizePicgoServerToken('  ')).toBeNull()
    expect(normalizePicgoServerToken('  secret  ')).toBe('secret')
  })
})

describe('imageUploadDestinationFromSettings', () => {
  it('maps settings fields', () => {
    expect(
      imageUploadDestinationFromSettings({
        picgo_server_url: 'https://cdn.example/upload',
        picgo_server_token: ' tok ',
      }),
    ).toEqual({
      picgoServerUrl: 'https://cdn.example/upload',
      picgoServerToken: 'tok',
    })
  })
})
