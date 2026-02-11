import {
	createTLSchema,
	JsonObject,
	parseTldrawJsonFile,
	TldrawFile,
	TLStore,
	UnknownRecord,
} from 'tldraw'
import { TLData } from '../document'

/**
 * Tldraw handles the migration here.
 * @param tldrawFileData
 * @returns
 */
export function migrateTldrawFileDataIfNecessary(tldrawFileData: string | TldrawFile): TLStore {
	const res = parseTldrawJsonFile({
		schema: createTLSchema(),
		json: typeof tldrawFileData === 'string' ? tldrawFileData : JSON.stringify(tldrawFileData),
	})

	if (!res.ok) {
		throw new Error('Unable to parse TldrawFile.')
	}

	return res.value
}

function isJsonUnknownRecord(json: JsonObject): json is JsonObject & UnknownRecord {
	const { id, typeName } = json as Partial<UnknownRecord>
	if (id === undefined || typeName === undefined) return false
	return true
}

/**
 * Should only be called with {@linkcode TLData} from when {@linkcode TLDRAW_VERSION} >= 2.1.4
 * @param tldata
 * @returns
 */
export function tLDataToTLStore(tldata: TLData): TLStore {
	const { tldrawFileFormatVersion, schema, records } = tldata.raw as Partial<TldrawFile>

	if (tldrawFileFormatVersion && schema && records) {
		return migrateTldrawFileDataIfNecessary({
			tldrawFileFormatVersion,
			schema,
			records,
		})
	}

	if (tldata.meta['tldraw-version'] !== '2.1.4') {
		throw new Error('The plugin expected the tldraw version of this tldata to be 2.1.4.')
	}

	const oldRecords = Object.values(tldata.raw ?? {})
		.filter((e) => e !== undefined && e !== null)
		.filter((e) => typeof e === 'object')
		.filter((e): e is JsonObject => !Array.isArray(e))
		.map((e) => {
			if (!isJsonUnknownRecord(e)) {
				throw new Error(`Invalid json object found while parsing: ${e}`)
			}
			return e
		})

	/**
	 * tldrawFileFormatVersion and schema were obtained by exporting a tldr file using tldraw version 2.1.4 and extracting the values.
	 */
	return migrateTldrawFileDataIfNecessary({
		records: oldRecords,
		tldrawFileFormatVersion: 1,
		schema: {
			schemaVersion: 2,
			sequences: {
				'com.tldraw.store': 4,
				'com.tldraw.asset': 1,
				'com.tldraw.camera': 1,
				'com.tldraw.document': 2,
				'com.tldraw.instance': 24,
				'com.tldraw.instance_page_state': 5,
				'com.tldraw.page': 1,
				'com.tldraw.instance_presence': 5,
				'com.tldraw.pointer': 1,
				'com.tldraw.shape': 4,
				'com.tldraw.asset.bookmark': 1,
				'com.tldraw.asset.image': 3,
				'com.tldraw.asset.video': 3,
				'com.tldraw.shape.group': 0,
				'com.tldraw.shape.text': 1,
				'com.tldraw.shape.bookmark': 2,
				'com.tldraw.shape.draw': 1,
				'com.tldraw.shape.geo': 8,
				'com.tldraw.shape.note': 6,
				'com.tldraw.shape.line': 4,
				'com.tldraw.shape.frame': 0,
				'com.tldraw.shape.arrow': 3,
				'com.tldraw.shape.highlight': 0,
				'com.tldraw.shape.embed': 4,
				'com.tldraw.shape.image': 3,
				'com.tldraw.shape.video': 2,
			},
		},
	})
}
