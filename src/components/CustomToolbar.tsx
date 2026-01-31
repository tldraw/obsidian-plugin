
import React from 'react';
import { DefaultToolbar, useTools, ToolbarItem } from "tldraw";
import { useTldrawInObsdianPlugin } from "src/contexts/plugin";

export function CustomToolbar() {
    const tools = useTools();
    const { plugin } = useTldrawInObsdianPlugin();
    const toolbarTools = plugin.settings.tldrawOptions?.toolbarTools;
    const orientation = plugin.settings.tldrawOptions?.toolbarOrientation ?? 'horizontal';

    if (!toolbarTools || !Array.isArray(toolbarTools)) {
        return (
            <DefaultToolbar orientation={orientation}>
                <ToolbarItem tool="select" />
                <ToolbarItem tool="hand" />
                <ToolbarItem tool="draw" />
                <ToolbarItem tool="eraser" />
            </DefaultToolbar>
        );
    }

    return (
        <DefaultToolbar orientation={orientation}>
            {toolbarTools.map(item => {
                if (!item.enabled) return null;
                // useIsToolSelected check is internal to ToolbarItem usually, or we can pass it if needed.
                // DefaultToolbarContent just does <ToolbarItem tool="..." />
                return <ToolbarItem key={item.id} tool={item.id} />
            })}
        </DefaultToolbar>
    );
}
