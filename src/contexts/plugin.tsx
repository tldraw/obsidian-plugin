import React, {
    createContext, ReactNode, useContext, useMemo
} from "react";
import TldrawPlugin from "src/main";
import TldrawInObsidianPluginInstance from "src/obsidian/plugin/instance";

export const PluginContext = createContext<{
    instance: TldrawInObsidianPluginInstance,
    plugin: TldrawPlugin
} | undefined>(undefined);

export function useTldrawInObsdianPlugin() {
    return useContext(PluginContext) ?? (() => {
        throw new Error(`Must be called within the provider tree`)
    })();
}

export function useObsidian() {
    return useTldrawInObsdianPlugin().instance.app;
}

export function TldrawInObsidianPluginProvider({
    children,
    plugin,
}: {
    children?: ReactNode
    plugin: TldrawPlugin,
}) {
    const value = useMemo(() => {
        return {
            instance: new TldrawInObsidianPluginInstance(plugin.app),
            plugin
        }
    }, [plugin])
    return (
        <PluginContext.Provider value={value}>
            {children}
        </PluginContext.Provider>
    )
}