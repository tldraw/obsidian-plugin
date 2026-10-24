import { describe, expect, it } from 'vitest'
import { mimeTypeFromExtension } from 'src/utils/mime-type'

describe('mimeTypeFromExtension', () => {
	it('maps the image types tldraw accepts', () => {
		expect(mimeTypeFromExtension('png')).toBe('image/png')
		expect(mimeTypeFromExtension('jpg')).toBe('image/jpeg')
		expect(mimeTypeFromExtension('jpeg')).toBe('image/jpeg')
		expect(mimeTypeFromExtension('svg')).toBe('image/svg+xml')
		expect(mimeTypeFromExtension('webp')).toBe('image/webp')
	})

	it('ignores case', () => {
		expect(mimeTypeFromExtension('PNG')).toBe('image/png')
		expect(mimeTypeFromExtension('JpG')).toBe('image/jpeg')
	})

	it('returns undefined for an unknown extension', () => {
		expect(mimeTypeFromExtension('xyz')).toBeUndefined()
		expect(mimeTypeFromExtension('')).toBeUndefined()
	})
})
