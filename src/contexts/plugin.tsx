import React, {
    createContext, ReactNode, useContext, useMemo
} from "react";
import type TldrawPlugin from "src/main";
import TldrawInObsidianPluginInstance from "src/obsidian/plugin/instance";

export const PluginContext = createContext<TldrawInObsidianPluginInstance | undefined>(undefined);

export function useTldrawInObsdianPlugin() {
    return useContext(PluginContext) ?? (() => {
        throw new Error(`Must be called within the provider tree`)
    })();
}

export function useObsidian() {
    return useTldrawInObsdianPlugin().app;
}

export function TldrawInObsidianPluginProvider({
    children,
    plugin,
}: {
    children?: ReactNode
    plugin: TldrawPlugin,
}) {
    const instance = useMemo(() => {
        return new TldrawInObsidianPluginInstance(plugin.app)
    }, [plugin])
    return (
        <PluginContext.Provider value={instance}>
            {children}
        </PluginContext.Provider>
    )
}