import React, { createContext, ReactNode, use, useMemo } from 'react'
import TldrawPlugin from 'src/plugin/TldrawPlugin'
import TldrawInObsidianPluginInstance from 'src/plugin/instance'

interface PluginContextValue {
	instance: TldrawInObsidianPluginInstance
	plugin: TldrawPlugin
}

export const PluginContext = createContext<PluginContextValue | undefined>(undefined)

export function useTldrawInObsdianPlugin() {
	return (
		use(PluginContext)?.instance ??
		(() => {
			throw new Error(`Must be called within the provider tree`)
		})()
	)
}

export function useTldrawPlugin() {
	return (
		use(PluginContext)?.plugin ??
		(() => {
			throw new Error(`Must be called within the provider tree`)
		})()
	)
}

export function useObsidian() {
	return useTldrawInObsdianPlugin().app
}

export function TldrawInObsidianPluginProvider({
	children,
	plugin,
}: {
	children?: ReactNode
	plugin: TldrawPlugin
}) {
	const value = useMemo(() => {
		return {
			instance: plugin.instance,
			plugin,
		}
	}, [plugin])
	return <PluginContext value={value}>{children}</PluginContext>
}
