import { unstable_batchedUpdates } from 'react-dom'
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { VIEW_TYPE_TLDRAW, ViewType } from './constants'

export type StatusBarUpdateType = 'react' | 'plugin'

export type StatusBarViewModeState = {
	view: {
		mode: ViewType
		source: StatusBarUpdateType
	}
}

export type StatusBarViewModeAction = {
	updateViewMode: (mode: ViewType, source: StatusBarUpdateType) => void
}

export const useStatusBarState = create<StatusBarViewModeState & StatusBarViewModeAction>()(
	subscribeWithSelector((set) => ({
		view: {
			mode: VIEW_TYPE_TLDRAW,
			source: 'plugin',
		},
		updateViewMode: (mode: ViewType, source: StatusBarUpdateType) =>
			set(() => ({ view: { mode, source } })),
	}))
)

export const safeUpdateStatusBarViewMode = (viewMode: ViewType) => {
	unstable_batchedUpdates(() => {
		useStatusBarState.getState().updateViewMode(viewMode, 'plugin')
	})
}
