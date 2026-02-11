import { JsonObject, JsonPrimitive, JsonValue, TldrawFile } from 'tldraw'

function isJSONPrimitive(value: unknown): value is JsonPrimitive {
	if (
		value === null ||
		typeof value === 'string' ||
		typeof value === 'number' ||
		typeof value === 'boolean'
	) {
		return true
	}

	return false
}

function pruneNonJSONValues(data: unknown): undefined | JsonValue {
	if (data === undefined) return undefined

	if (isJSONPrimitive(data)) {
		return data
	}

	if (typeof data !== 'object') return undefined

	if (Array.isArray(data)) {
		return data.map(pruneNonJSONValues).filter((item) => item !== undefined)
	}

	const json: JsonObject = {}

	for (const [key, val] of Object.entries(data)) {
		if (key in data) {
			const prunedValue = pruneNonJSONValues(val)
			if (prunedValue !== undefined) {
				json[key] = prunedValue
			}
		}
	}

	return json
}

export function tldrawFileToJson(tldrawFile: TldrawFile): JsonObject {
	const res = pruneNonJSONValues(tldrawFile)
	if (res === undefined || isJSONPrimitive(res) || Array.isArray(res)) {
		throw new Error('TldrawFile is not a JsonObject')
	}
	return res
}
