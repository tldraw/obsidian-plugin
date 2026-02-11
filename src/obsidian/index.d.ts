import {} from 'obsidian'

declare module 'obsidian' {
	namespace App {
		interface EmbedFactoryContext {
			app: App
			containerEl: HTMLElement
			depth: number
			displayMode: boolean
			linktext: string
			showInline: boolean
			/**
			 * The path to the file that {@linkcode containerEl} is embed in
			 */
			sourcePath: string
		}

		interface ExtensionEmbedFactory {
			/**
			 * @param context The context for the embed created from {@linkcode tFile}.
			 * @param tFile The embed file.
			 */
			(context: EmbedFactoryContext, tFile: TFile, param2: string): void
		}

		interface EmbedRegistry {
			registerExtension(extension: string, factory: ExtensionEmbedFactory): void
			unregisterExtension(extension: string): void
		}
	}

	interface App {
		/**
		 *
		 * @param path A vault file path
		 * @returns
		 */
		openWithDefaultApp(path: string): void
		embedRegistry: App.EmbedRegistry
		dom: {
			statusBarEl: HTMLElement
		}
	}

	interface Menu {
		dom: HTMLElement
	}

	interface Workspace {
		/**
		 * This isn't provided by the Obsidian API, but we can still call it.
		 *
		 * Internally it does the following:
		 *
		 * ```
		 * this.trigger("quick-preview", file, data);
		 * ```
		 *
		 * This event can be captured by using {@linkcode Workspace.on} like so:
		 *
		 * ```
		 * app.workspace.on("quick-preview", (file, data) => {
		 *   // Do something with `file` and `data`
		 * });
		 * ```
		 *
		 * @param file
		 * @param data
		 * @returns
		 */
		onQuickPreview(file: TFile, data: string): void
	}

	interface Vault {
		config: {
			attachmentFolderPath?: '/' | `./${string}` | (string & NonNullable<unknown>)
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	interface SuggestModal<T = unknown> {
		/**
		 * This function is present at runtime in the web developer console in Obsidian, but not in the type definition for some reason.
		 */
		updateSuggestions(): void
	}

	interface Editor {
		getClickableTokenAt(position: EditorPosition):
			| undefined
			| ({
					end: EditorPosition
					start: EditorPosition
					text: string
			  } & (
					| {
							displayText?: undefined
							type: 'blockid' | 'tag'
					  }
					| {
							displayText: string
							type: 'internal-link'
					  }
			  ))
	}

	interface Component {
		_loaded: boolean
	}

	interface AbstractInputSuggest<T> {
		lastRect?: DOMRect
		suggestEl: HTMLDivElement
		textInputEl: HTMLInputElement | HTMLDivElement
		/**
		 * Calls the {@linkcode renderSuggestion} function for each value.
		 *
		 * Not defined by Obsidian APIs, but exists regardless.
		 */
		showSuggestions(values: T[]): void

		/**
		 * Repositions the popover underneath the `textInputEl` from the {@linkcode AbstractInputSuggest['constructor']} call.
		 *
		 * Not defined by Obsidian APIs, but exists regardless.
		 */
		autoReposition(): void
	}
}
