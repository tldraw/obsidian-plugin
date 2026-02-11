import { createTLSchema, JsonObject, SerializedStore, TLRecord } from 'tldraw'

/**
 *
 * Only meant to be used with tldraw data saved from when this plugin used version `2.0.0-alpha.14` of tldraw.
 *
 * @returns
 */
export function migrationOld(tldataRaw: JsonObject) {
	const migrationResult = createTLSchema().migrateStoreSnapshot({
		// Obtained from running `tldraw.editor.store.schema.serialize()` in the Obsidian Developer Console with the previous plugin version installed.
		schema: {
			schemaVersion: 1,
			storeVersion: 4,
			recordVersions: {
				asset: {
					version: 1,
					subTypeKey: 'type',
					subTypeVersions: {
						image: 2,
						video: 2,
						bookmark: 0,
					},
				},
				camera: {
					version: 1,
				},
				document: {
					version: 2,
				},
				instance: {
					version: 17,
				},
				instance_page_state: {
					version: 3,
				},
				page: {
					version: 1,
				},
				shape: {
					version: 3,
					subTypeKey: 'type',
					subTypeVersions: {
						group: 0,
						embed: 4,
						bookmark: 1,
						image: 2,
						text: 1,
						draw: 1,
						geo: 6,
						line: 0,
						note: 4,
						frame: 0,
						arrow: 1,
						highlight: 0,
						video: 1,
					},
				},
				instance_presence: {
					version: 4,
				},
				pointer: {
					version: 1,
				},
			},
		},
		// Cast the raw tldata as a SerializedStore even though it may not be a valid one, it is up to tldraw to report this back to the user, which may indicate a the file may have been improperly formatted.
		store: tldataRaw as Record<string, unknown> as SerializedStore<TLRecord>,
	})

	if (migrationResult.type === 'error') {
		throw Error('Tldraw migration failed.')
	}

	return migrationResult.value
}
