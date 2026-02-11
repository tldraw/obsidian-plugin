import TldrawPlugin from 'src/main'
import { logClass } from '../logging'

type ObsidianPluginConstructor = new (
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	...args: any[]
) => TldrawPlugin

/**
 * Mark
 * @param Base
 * @param args
 * @returns
 */
export function pluginBuild<T extends ObsidianPluginConstructor>(
	Base: T,
	args: unknown
): ObsidianPluginConstructor {
	// TODO: Differentiate between production build or development build of this plugin.
	// TODO: Return Base if this is a production build, otherwise return TldrawPluginDevelopment.

	const decoratedPlugin = Base.name

	/**
	 * This is can be used to help create new builds without having to unnecessarily modify {@linkcode TldrawPlugin}.
	 *
	 * For example, modify this class instead by overriding and adding new functions. Then later when the new
	 * changes are satisfactory, refactor the code into {@linkcode TldrawPlugin}.
	 *
	 * Try to keep this class as minimal as possible to help assist with development cycles.
	 */
	class TldrawPluginDevelopment extends Base {
		onload() {
			logClass(TldrawPluginDevelopment, this.onload, `Loading plugin '${decoratedPlugin}.`)
			return super.onload()
		}

		onunload() {
			logClass(TldrawPluginDevelopment, this.onload, `Unloading plugin '${decoratedPlugin}'.`)
			return super.onunload()
		}
	}

	console.log(`Decorating '${decoratedPlugin}' as '${TldrawPluginDevelopment.name}'`)

	return TldrawPluginDevelopment
}
