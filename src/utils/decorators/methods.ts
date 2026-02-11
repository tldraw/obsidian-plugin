/* jon-dez */

type KeysOfType<T extends object, Type> = keyof {
	[key in keyof T as T[key] extends Type ? key : never]: 0
}

export type MethodKeys<T extends object> = KeysOfType<T, CallableFunction>

export type Interceptor<
	T,
	TTarget extends object,
	TTargetMethod extends MethodKeys<TTarget>,
	TMethodArgs extends any[],
	TMethodReturn,
> = TTarget[TTargetMethod] extends (...args: infer Args) => infer Return
	? (
			this: T,
			targetMethod: (...args: Args) => Return,
			thisMethod: (...args: TMethodArgs) => TMethodReturn
		) => TTarget[TTargetMethod]
	: never

export function intercept<
	T,
	TTarget extends object,
	TTargetMethod extends MethodKeys<TTarget>,
	TMethodArgs extends any[],
	TMethodReturn,
>(
	selector: (instance: T) => TTarget,
	method: TTargetMethod,
	interceptor: Interceptor<T, TTarget, TTargetMethod, TMethodArgs, TMethodReturn>
) {
	return function <This extends T>(
		thisMethod: (this: This, ...args: TMethodArgs) => TMethodReturn,
		context: ClassMethodDecoratorContext<This, typeof thisMethod>
	) {
		context.addInitializer(function () {
			const targetObject = selector(this)
			const originalTargetMethod = targetObject[method]

			if (!(originalTargetMethod instanceof Function)) {
				throw new Error(`Method ${String(method)} is not a function`)
			}

			targetObject[method] = interceptor.bind(this)(
				originalTargetMethod.bind(targetObject),
				thisMethod.bind(this)
			)
		})
	}
}