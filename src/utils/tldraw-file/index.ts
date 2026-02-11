import { createTLStore, TldrawFile, TLStore } from 'tldraw'

/**
 *
 * @param store The store to create a file from. Leave this undefined to create a blank tldraw file.
 * @returns
 */
export function createRawTldrawFile(store?: TLStore): TldrawFile {
	store ??= createTLStore()
	return {
		tldrawFileFormatVersion: 1,
		schema: store.schema.serialize(),
		records: store.allRecords(),
	}
}
