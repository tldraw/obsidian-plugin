import UserSettingsManager from 'src/obsidian/settings/UserSettingsManager'
import { Editor, ScribbleItem } from 'tldraw'

function isLaserScribbleAndKeepDelayAfterStop(
	item: ScribbleItem,
	userSettings: UserSettingsManager
) {
	return (
		item.scribble.color === 'laser' && userSettings.settings.tldrawOptions?.laserKeepDelayAfterStop
	)
}

export default function monkeyPatchEditorInstance(
	editor: Editor,
	userSettings: UserSettingsManager
) {
	/**
	 * Modified from tldraw package source: packages/editor/src/lib/editor/managers/ScribbleManager.ts
	 *
	 * The original {@linkcode editor.scribbles.stop} method hardcodes a maximum 200 millisecond
	 * delay before any scribble disappears.
	 *
	 * For our purposes, we allow only the laser color to ignore this delay.
	 */
	editor.scribbles.stop = function stop(id: ScribbleItem['id']) {
		const item = this.scribbleItems.get(id)
		if (!item) throw Error(`Scribble with id ${id} not found`)
		if (!isLaserScribbleAndKeepDelayAfterStop(item, userSettings)) {
			item.delayRemaining = Math.min(item.delayRemaining, 200)
		}
		item.scribble.state = 'stopping'
		return item
	}

	/**
	 * Modified from tldraw package source: packages/editor/src/lib/editor/managers/ScribbleManager.ts
	 *
	 * The original {@linkcode editor.scribbles.tick} method resets the scribble item delay
	 */
	editor.scribbles.tick = function tick(elapsed) {
		if (this.scribbleItems.size === 0) return
		editor.run(() => {
			this.scribbleItems.forEach((item) => {
				// let the item get at least eight points before
				//  switching from starting to active
				if (item.scribble.state === 'starting') {
					const { next, prev } = item
					if (next && next !== prev) {
						item.prev = next
						item.scribble.points.push(next)
					}

					if (item.scribble.points.length > 8) {
						item.scribble.state = 'active'
					}
					return
				}

				if (item.delayRemaining > 0) {
					item.delayRemaining = Math.max(0, item.delayRemaining - elapsed)
				}

				item.timeoutMs += elapsed
				if (item.timeoutMs >= 16) {
					item.timeoutMs = 0
				}

				const { delayRemaining, timeoutMs, prev, next, scribble } = item

				switch (scribble.state) {
					case 'active': {
						if (next && next !== prev) {
							item.prev = next
							scribble.points.push(next)

							// If we've run out of delay, then shrink the scribble from the start
							if (delayRemaining === 0) {
								if (scribble.points.length > 8) {
									scribble.points.shift()
								}
							}
						} else {
							// While not moving, shrink the scribble from the start
							if (timeoutMs === 0 && !isLaserScribbleAndKeepDelayAfterStop(item, userSettings)) {
								if (scribble.points.length > 1) {
									scribble.points.shift()
								} else {
									// Reset the item's delay
									item.delayRemaining = scribble.delay
								}
							}
						}
						break
					}
					case 'stopping': {
						if (item.delayRemaining === 0) {
							if (timeoutMs === 0) {
								// If the scribble is down to one point, we're done!
								if (scribble.points.length === 1) {
									this.scribbleItems.delete(item.id) // Remove the scribble
									return
								}

								if (scribble.shrink) {
									// Drop the scribble's size as it shrinks
									scribble.size = Math.max(1, scribble.size * (1 - scribble.shrink))
								}

								// Drop the scribble's first point (its tail)
								scribble.points.shift()
							}
						}
						break
					}
					case 'paused': {
						// Nothing to do while paused.
						break
					}
				}
			})

			// The object here will get frozen into the record, so we need to
			// create a copies of the parts that what we'll be mutating later.
			editor.updateInstanceState({
				scribbles: Array.from(this.scribbleItems.values())
					.map(({ scribble }) => ({
						...scribble,
						points: [...scribble.points],
					}))
					.slice(-5), // limit to three as a minor sanity check
			})
		})
	}
}
