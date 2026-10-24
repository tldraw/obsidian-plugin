const MIME_TYPES_BY_EXTENSION: Record<string, string> = {
	png: 'image/png',
	apng: 'image/apng',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	webp: 'image/webp',
	avif: 'image/avif',
	svg: 'image/svg+xml',
	bmp: 'image/bmp',
	ico: 'image/x-icon',
	mp4: 'video/mp4',
	webm: 'video/webm',
	mov: 'video/quicktime',
	pdf: 'application/pdf',
}

/**
 * The mime type for a file extension, without the leading dot and ignoring case. Returns
 * `undefined` for an extension that is not known.
 */
export function mimeTypeFromExtension(extension: string): string | undefined {
	return MIME_TYPES_BY_EXTENSION[extension.toLowerCase()]
}
