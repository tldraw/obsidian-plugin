import React, { createContext, ReactNode, useContext, useMemo } from 'react'
import TldrawPlugin from 'src/main'
import TldrawInObsidianPluginInstance from 'src/obsidian/plugin/instance'

interface PluginContextValue {
	instance: TldrawInObsidianPluginInstance
	plugin: TldrawPlugin
}

export const PluginContext = createContext<PluginContextValue | undefined>(undefined)

export function useTldrawInObsdianPlugin() {
	return (
		useContext(PluginContext)?.instance ??
		(() => {
			throw new Error(`Must be called within the provider tree`)
		})()
	)
}

export function useTldrawPlugin() {
	return (
		useContext(PluginContext)?.plugin ??
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
	return <PluginContext.Provider value={value}>{children}</PluginContext.Provider>
}
