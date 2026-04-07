/**
 * Offline asset downloads use the published {@link https://www.npmjs.com/package/@tldraw/assets | @tldraw/assets}
 * package (same version as the `tldraw` dependency). GitHub release tags do not exist for internal/prerelease versions.
 * jsDelivr serves npm package contents path-for-path from the registry tarball.
 */
export const TLDRAW_NPM_ASSETS_BASE_URL =
	`https://cdn.jsdelivr.net/npm/@tldraw/assets@${TLDRAW_VERSION}` as const

export function tldrawNpmAssetsBrowseUrl(subpath: string) {
	const v = encodeURIComponent(TLDRAW_VERSION)
	// strip leading slashes, if any
	const p = subpath.replace(/^\/+/, '')
	return `https://unpkg.com/browse/@tldraw/assets@${v}/${p}`
}
