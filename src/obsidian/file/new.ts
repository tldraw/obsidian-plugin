const currentFileBasenameMatch = /{{\s*(currentFileBasename)\s*}}/g

/**
 * Available template replacements for file prefixes:
 * - {{ currentFileBasename }}: The basename of the current active file without extension.
 */
export function formatFilePrefix(
	prefix: string,
	{
		currentFileBasename,
	}: {
		currentFileBasename?: string
	}
) {
	// if(currentFileBasenameMatch.test(prefix)) {
	//     if(!currentFileBasename)
	//     throw new Error('The file prefix template requires the current file basename, but there is no active file.');
	// }
	return prefix.replace(currentFileBasenameMatch, currentFileBasename || '')
}
