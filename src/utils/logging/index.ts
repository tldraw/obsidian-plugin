export type ConsoleLogParams = unknown[]

export function logClass<
	T extends new (...args: any[]) => unknown,
	U extends (this: T, ...args: never) => unknown,
>(targetClass: T, target: U, ...args: ConsoleLogParams) {
	console.debug(`${targetClass.name}.${target.name}:`, ...args)
}

export function logFn<T extends CallableFunction>(target: T, ...args: ConsoleLogParams) {
	console.debug(`${target.name}:`, ...args)
}

export const LOGGING_ENABLED = false
export const TLDRAW_STORES_MANAGER_LOGGING = LOGGING_ENABLED && false
