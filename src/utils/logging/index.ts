export type ConsoleLogParams = Parameters<typeof console.log>

export function logClass<
	T extends new (...args: unknown[]) => unknown,
	U extends (this: T, ...args: never) => unknown,
>(targetClass: T, target: U, ...args: ConsoleLogParams) {
	console.log(`${targetClass.name}.${target.name}:`, ...args)
}

export function logFn<T extends CallableFunction>(target: T, ...args: ConsoleLogParams) {
	console.log(`${target.name}:`, ...args)
}

export const LOGGING_ENABLED = false
export const TLDRAW_STORES_MANAGER_LOGGING = LOGGING_ENABLED && false
