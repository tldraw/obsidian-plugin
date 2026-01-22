import { createTLStore, TldrawFile, TLStore, defaultShapeUtils } from "tldraw"
import { PdfPageShapeUtil } from "src/tldraw/shapes/PdfPageShapeUtil";

/**
 * 
 * @param store The store to create a file from. Leave this undefined to create a blank tldraw file.
 * @returns 
 */
export function createRawTldrawFile(store?: TLStore): TldrawFile {
	store ??= createTLStore({
		shapeUtils: [...defaultShapeUtils, PdfPageShapeUtil]
	});
	return {
		tldrawFileFormatVersion: 1,
		schema: store.schema.serialize(),
		records: store.allRecords(),
	}
}
