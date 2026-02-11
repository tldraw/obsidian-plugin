import { JsonObject, JsonValue, OptionalKeys } from 'tldraw'
import { TLDATA_DELIMITER_END, TLDATA_DELIMITER_START } from './constants'
import { TLData, TLExistingDataDocument, TldrawPluginMetaData, getTLMetaTemplate } from './document'
import { migrateIfNecessary } from './migrate'
import { extractDataBetweenKeywords } from './utils'

type NestedPartial<T> = {
	[K in keyof T]?: T[K] extends object ? NestedPartial<T[K]> : T[K]
}

type UUIDOptionalTLMeta = OptionalKeys<TLData['meta'], 'uuid'>

function isProperTLMeta(data: JsonObject): data is JsonObject & UUIDOptionalTLMeta {
	const { 'plugin-version': pv, 'tldraw-version': tv } = data as Partial<TLData['meta']>
	if (tv === undefined || pv === undefined) {
		return false
	}
	return true
}

function parseTLJsonData(data: JsonValue): TLData {
	const { meta, raw } = data as NestedPartial<TLData>

	if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
		throw new Error('Invalid TLData: Expected a JsonObject')
	}

	if (meta === undefined || !isProperTLMeta(meta)) {
		throw new Error('Invalid TLData parsed.')
	}

	return {
		meta: {
			...meta,
			uuid: meta.uuid ?? window.crypto.randomUUID(),
		},
		raw: raw ?? {},
	}
}

export function parseTLDataDocument(
	pluginVersion: string,
	fileData: string
):
	| TLExistingDataDocument
	| {
			meta: TldrawPluginMetaData
			store?: undefined
			raw?: undefined
	  } {
	const extracted = extractDataBetweenKeywords(
		fileData,
		TLDATA_DELIMITER_START,
		TLDATA_DELIMITER_END
	)

	return !extracted
		? { meta: getTLMetaTemplate(pluginVersion) }
		: migrateIfNecessary(pluginVersion, parseTLJsonData(JSON.parse(extracted)))
}
