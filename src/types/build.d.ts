declare global {
	/**
	 * This will be defined in the build process, and is used to keep or strip logging for statements that use the following pattern:
	 *
	 * ```ts
	 * LOGGING && console.log('message');
	 * ```
	 */
	const TLDRAW_COMPONENT_LOGGING: boolean
	const MARKDOWN_POST_PROCESSING_LOGGING: boolean
	/**
	 * The current `tldraw` package version as defined in `node_modules`.
	 *
	 * Injected at build time.
	 */
	const TLDRAW_VERSION: string
}

export {}
