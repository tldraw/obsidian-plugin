export type ConsoleLogParams = unknown[]

export function logClass<
	T extends new (...args: never[]) => unknown,
	U extends (this: T, ...args: never) => unknown,
>(targetClass: T, target: U | (keyof InstanceType<T> & string), ...args: ConsoleLogParams) {
	// A method name can be given instead of the method itself, which avoids passing an unbound method.
	const name = typeof target === 'string' ? target : target.name
	console.debug(`${targetClass.name}.${name}:`, ...args)
}

export function logFn<T extends CallableFunction>(target: T, ...args: ConsoleLogParams) {
	console.debug(`${target.name}:`, ...args)
}

export const LOGGING_ENABLED = false
export const TLDRAW_STORES_MANAGER_LOGGING = LOGGING_ENABLED && false
