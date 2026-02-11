/**
 * https://wicg.github.io/file-system-access/#enumdef-wellknowndirectory
 */
type WellKnownDirectory = 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos'

/**
 * https://wicg.github.io/file-system-access/#api-filepickeroptions
 */
type FilePickerOptions = {
	id?: string
	startIn?: WellKnownDirectory | FileSystemHandle
	types?: {
		description: string
		/**
		 * Mime type to
		 */
		accept: Record<string, string[]>
	}[]
	excludeAcceptAllOption?: boolean
}

declare global {
	interface Window {
		/**
		 * https://developer.chrome.com/docs/capabilities/web-apis/file-system-access
		 * @param options
		 * @returns
		 */
		showOpenFilePicker: (options?: FilePickerOptions) => Promise<FileSystemFileHandle[]>
	}
}

export default {}
