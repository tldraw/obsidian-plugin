// Original source: https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/94fbac38bfc5036187a81c7883c03830a622bc1d/src/utils/DebugHelper.ts#L1

export const durationTreshold = 0 //0.05; //ms

export const log = console.log.bind(window.console)
export const debug = (fn: CallableFunction, fnName: string, ...messages: unknown[]) => {
	console.log(fnName, fn, ...messages)
}

const DEBUG_MODE = false

export class CustomMutationObserver extends MutationObserver {
	constructor(callback: MutationCallback, name: string) {
		super(
			!DEBUG_MODE
				? callback
				: async (mutationsList, observer) => {
						const startTime = performance.now() // Get start time
						await callback(mutationsList, observer) // Invoke the original callback
						const endTime = performance.now() // Get end time
						const executionTime = endTime - startTime
						if (executionTime > durationTreshold) {
							console.log(
								`${CustomMutationObserver.name}.${name} MutationObserver callback took ${executionTime}ms to execute`,
								observer
							)
						}
					}
		)
	}
}
