import React, { useCallback, useMemo } from "react";
import Setting from "./Setting";
import SettingGroup from "./SettingGroup";
import CameraOptionsSettings from "./CameraOptionsSettings";
import useSettingsManager from "src/hooks/useSettingsManager";
import useUserPluginSettings from "src/hooks/useUserPluginSettings";
import { defaultTldrawOptions } from "tldraw";

function StrokeParametersGroup() {
    const settingsManager = useSettingsManager();
    const settings = useUserPluginSettings(settingsManager);
    const strokeParams = settings.tldrawOptions?.strokeParameters ?? {};

    const updateStrokeParam = useCallback(async (key: string, val: string | boolean) => {
        let value: any = val;
        if (typeof val === 'string') {
            value = parseFloat(val);
            if (isNaN(value)) return;
        }

        await settingsManager.updateSettings({
            ...settings,
            tldrawOptions: {
                ...settings.tldrawOptions,
                strokeParameters: {
                    ...strokeParams,
                    [key]: value
                }
            }
        });
    }, [settings, settingsManager, strokeParams]);

    return (
        <>
            <Setting
                slots={{
                    name: 'Streamline',
                    desc: 'Controls how much the line is smoothed over time.',
                    control: (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={strokeParams.streamline ?? 0.2}
                                onChange={(e) => updateStrokeParam('streamline', e.target.value)}
                            />
                            <span>{strokeParams.streamline ?? 0.2}</span>
                        </div>
                    )
                }}
            />
            <Setting
                slots={{
                    name: 'Smoothing',
                    desc: 'Controls the "roundness" of the line.',
                    control: (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={strokeParams.smoothing ?? 0.5}
                                onChange={(e) => updateStrokeParam('smoothing', e.target.value)}
                            />
                            <span>{strokeParams.smoothing ?? 0.5}</span>
                        </div>
                    )
                }}
            />
            <Setting
                slots={{
                    name: 'Thinning',
                    desc: 'Controls how much the line thins based on pressure.',
                    control: (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                                type="range"
                                min=" -1"
                                max="1"
                                step="0.01"
                                value={strokeParams.thinning ?? 0.5}
                                onChange={(e) => updateStrokeParam('thinning', e.target.value)}
                            />
                            <span>{strokeParams.thinning ?? 0.5}</span>
                        </div>
                    )
                }}
            />
            <Setting
                slots={{
                    name: 'Simulate Pressure',
                    desc: 'Whether to simulate pressure if the device does not support it.',
                    control: (
                        <Setting.Toggle
                            value={!!strokeParams.simulatePressure}
                            onChange={(val) => updateStrokeParam('simulatePressure', val)}
                        />
                    )
                }}
            />
        </>
    );
}

function ToolbarToolsGroup() {
    const settingsManager = useSettingsManager();
    const settings = useUserPluginSettings(settingsManager);

    // All available tools
    const allToolIds = [
        'select', 'hand', 'draw', 'eraser', 'arrow', 'text', 'note', 'asset',
        'rectangle', 'ellipse', 'triangle', 'diamond', 'hexagon', 'oval', 'rhombus',
        'star', 'cloud', 'heart', 'x-box', 'check-box', 'line', 'highlight',
        'laser', 'frame', 'lasso-select'
    ];

    // Get current enabled tools as comma-separated string
    const currentTools = useMemo(() => {
        const t = settings.tldrawOptions?.toolbarTools;
        if (!t || !Array.isArray(t) || t.length === 0) {
            return allToolIds.join(', ');
        }
        return (t as { id: string, enabled: boolean }[])
            .filter(tool => tool.enabled)
            .map(tool => tool.id)
            .join(', ');
    }, [settings.tldrawOptions?.toolbarTools]);

    const [inputValue, setInputValue] = React.useState(currentTools);
    const [error, setError] = React.useState<string | null>(null);

    // Update input when settings change externally
    React.useEffect(() => {
        setInputValue(currentTools);
    }, [currentTools]);

    const updateTools = useCallback(async (toolsString: string) => {
        const toolIds = toolsString
            .split(',')
            .map(s => s.trim().toLowerCase())
            .filter(s => s.length > 0);

        // Validate tool IDs
        const invalidTools = toolIds.filter(id => !allToolIds.includes(id));
        if (invalidTools.length > 0) {
            setError(`Unknown tools: ${invalidTools.join(', ')}`);
            return;
        }

        setError(null);

        // Create new toolbar tools array - enabled tools in specified order
        const newToolbarTools = allToolIds.map(id => ({
            id,
            enabled: toolIds.includes(id)
        }));

        // Reorder: put enabled tools first in user's order, then disabled ones
        const enabledOrdered = toolIds.map(id => ({ id, enabled: true }));
        const disabled = allToolIds
            .filter(id => !toolIds.includes(id))
            .map(id => ({ id, enabled: false }));

        await settingsManager.updateSettings({
            ...settings,
            tldrawOptions: {
                ...settings.tldrawOptions,
                toolbarTools: [...enabledOrdered, ...disabled]
            }
        });
    }, [settings, settingsManager, allToolIds]);

    const handleInputChange = (value: string) => {
        setInputValue(value);
    };

    const handleBlur = () => {
        updateTools(inputValue);
    };

    const resetToDefault = () => {
        const defaultValue = allToolIds.join(', ');
        setInputValue(defaultValue);
        updateTools(defaultValue);
    };

    return (
        <>
            <Setting
                slots={{
                    name: 'Toolbar Tools',
                    desc: (
                        <>
                            <p>Enter the tools you want visible in the toolbar, in order, separated by commas.</p>
                            <p><strong>Available tools:</strong></p>
                            <code className="ptl-default-code" style={{ display: 'block', whiteSpace: 'pre-wrap', fontSize: '11px' }}>
                                {allToolIds.join(', ')}
                            </code>
                            {error && <p style={{ color: 'var(--text-error)' }}>{error}</p>}
                        </>
                    ),
                    control: (
                        <>
                            <Setting.ExtraButton
                                icon="reset"
                                tooltip="Reset to all tools"
                                onClick={resetToDefault}
                            />
                        </>
                    )
                }}
            />
            <textarea
                value={inputValue}
                onChange={(e) => handleInputChange(e.target.value)}
                onBlur={handleBlur}
                placeholder="select, hand, draw, eraser..."
                style={{
                    width: '100%',
                    minHeight: '60px',
                    padding: '8px',
                    fontFamily: 'var(--font-monospace)',
                    fontSize: '12px',
                    borderRadius: '4px',
                    border: '1px solid var(--background-modifier-border)',
                    backgroundColor: 'var(--background-primary)',
                    color: 'var(--text-normal)',
                    resize: 'vertical'
                }}
            />
        </>
    );
}
function TldrawEditorOptionsGroup() {
    const settingsManager = useSettingsManager();
    const settings = useUserPluginSettings(settingsManager);

    const onLaserDelayMsChange = useCallback(async (value: string) => {
        const parsedValue = parseInt(value);
        if (Number.isNaN(parsedValue)) return;
        await settingsManager.updateLaserDelayMs(parsedValue);
    }, [settingsManager]);

    const resetLaserDelayMs = useCallback(async () => {
        await settingsManager.updateLaserDelayMs(undefined);
    }, [settingsManager]);

    const onLaserKeepDelay = useCallback(async (value: boolean) => {
        await settingsManager.updateLaserKeepDelayAfterStop(value);
    }, [settingsManager]);

    const resetLaserKeepDelay = useCallback(async () => {
        await settingsManager.updateLaserKeepDelayAfterStop(undefined);
    }, [settingsManager]);

    const onForceCompactMode = useCallback(async (value: boolean) => {
        await settingsManager.updateSettings({
            ...settings,
            tldrawOptions: {
                ...settings.tldrawOptions,
                forceCompactMode: value
            }
        });
    }, [settingsManager, settings]);

    return (
        <>
            <Setting
                slots={{
                    name: 'Laser delay',
                    desc: 'The delay for the laser tool in milliseconds.',
                    control: (
                        <>
                            <Setting.Text
                                value={`${settings.tldrawOptions?.laserDelayMs ?? ''}`}
                                placeholder={`${defaultTldrawOptions.laserDelayMs}`}
                                onChange={onLaserDelayMsChange}
                            />
                            <Setting.ExtraButton
                                icon={'reset'}
                                tooltip={'reset'}
                                onClick={resetLaserDelayMs}
                            />
                        </>
                    )
                }}
            />
            <Setting
                slots={{
                    name: 'Laser keep delay after stop',
                    desc: 'Keep the laser delay lingering after stopping the laser tool.',
                    control: (
                        <>
                            <Setting.Toggle
                                value={!!settings.tldrawOptions?.laserKeepDelayAfterStop}
                                onChange={onLaserKeepDelay}
                            />
                            <Setting.ExtraButton
                                icon={'reset'}
                                tooltip={'reset'}
                                onClick={resetLaserKeepDelay}
                            />
                        </>
                    )
                }}
            />
            <Setting
                slots={{
                    name: 'Force Compact Mode',
                    desc: 'Force the compact mode (mobile layout) on desktop.',
                    control: (
                        <Setting.Toggle
                            value={!!settings.tldrawOptions?.forceCompactMode}
                            onChange={onForceCompactMode}
                        />
                    )
                }}
            />
        </>
    )
}

function ClipboardOptionsGroup() {
    const settingsManager = useSettingsManager();
    const settings = useUserPluginSettings(settingsManager);
    const onPasteAtCursor = useCallback(async (value: boolean) => {
        await settingsManager.updatePasteAtCursor(value);
    }, [settingsManager]);

    const resetPasteAtCursor = useCallback(async () => {
        await settingsManager.updatePasteAtCursor(undefined);
    }, [settingsManager]);
    return (
        <>
            <Setting
                slots={{
                    name: 'Paste at cursor',
                    desc: (
                        <>
                            This can be accessed in the editor by navigating the menu:<br />
                            <code>
                                {'Menu > Preferences > Paste at cursor'}
                            </code>
                        </>
                    ),
                    control: (
                        <>
                            <Setting.Toggle
                                value={!!settings.clipboard?.pasteAtCursor}
                                onChange={onPasteAtCursor}
                            />
                            <Setting.ExtraButton
                                icon={'reset'}
                                tooltip={'reset'}
                                onClick={resetPasteAtCursor}
                            />
                        </>
                    )
                }}
            />
        </>
    )
}


function StrokeOptionsGroup() {
    const settingsManager = useSettingsManager();
    const settings = useUserPluginSettings(settingsManager);
    const strokeSizes = {
        s: 0.1, m: 0.3, l: 0.6, xl: 1.2,
        ...settings.tldrawOptions?.strokeSizes
    };

    const updateStrokeSize = useCallback(async (key: keyof typeof strokeSizes, val: string) => {
        const num = parseFloat(val);
        if (isNaN(num)) return;
        await settingsManager.updateSettings({
            ...settings,
            tldrawOptions: {
                ...settings.tldrawOptions,
                strokeSizes: {
                    s: 0.1, m: 0.3, l: 0.6, xl: 1.2,
                    ...settings.tldrawOptions?.strokeSizes,
                    [key]: num
                }
            }
        });
    }, [settings, settingsManager]);

    const updateDefaultSize = useCallback(async (val: string) => {
        await settingsManager.updateSettings({
            ...settings,
            tldrawOptions: {
                ...settings.tldrawOptions,
                defaultStrokeSize: val as any
            }
        });
    }, [settings, settingsManager]);

    const updateDefaultStyle = useCallback(async (val: string) => {
        await settingsManager.updateSettings({
            ...settings,
            tldrawOptions: {
                ...settings.tldrawOptions,
                defaultStrokeStyle: val as any
            }
        });
    }, [settings, settingsManager]);

    return (
        <>
            <Setting
                slots={{
                    name: 'Stroke Sizes',
                    desc: 'Customize the thickness for S, M, L, XL sizes.',
                    control: (
                        <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                            {Object.entries(strokeSizes).map(([key, val]) => (
                                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ width: '20px', textTransform: 'uppercase' }}>{key}</span>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={val}
                                        onChange={(e) => updateStrokeSize(key as any, e.target.value)}
                                        style={{ width: '60px' }} // Optional styling
                                    />
                                </div>
                            ))}
                        </div>
                    )
                }}
            />
            <Setting
                slots={{
                    name: 'Default Stroke Size',
                    desc: 'The size used for new shapes by default.',
                    control: (
                        <select
                            value={settings.tldrawOptions?.defaultStrokeSize ?? 'm'}
                            onChange={(e) => updateDefaultSize(e.target.value)}
                            className="dropdown"
                        >
                            <option value="s">Small</option>
                            <option value="m">Medium</option>
                            <option value="l">Large</option>
                            <option value="xl">X-Large</option>
                        </select>
                    )
                }}
            />
            <Setting
                slots={{
                    name: 'Default Stroke Style',
                    desc: 'The style used for new shapes by default.',
                    control: (
                        <select
                            value={settings.tldrawOptions?.defaultStrokeStyle ?? 'draw'}
                            onChange={(e) => updateDefaultStyle(e.target.value)}
                            className="dropdown"
                        >
                            <option value="draw">Draw</option>
                            <option value="dashed">Dashed</option>
                            <option value="dotted">Dotted</option>
                            <option value="solid">Solid</option>
                        </select>
                    )
                }}
            />
        </>
    );
}

export default function TldrawEditorOptions() {
    return (
        <>
            <SettingGroup name="Clipboard options">
                <ClipboardOptionsGroup />
            </SettingGroup>

            <SettingGroup name="Pointer options">
                <TldrawEditorOptionsGroup />
            </SettingGroup>

            <SettingGroup name="Stroke options">
                <StrokeOptionsGroup />
                <h3>Advanced Parameters</h3>
                <StrokeParametersGroup />
            </SettingGroup>

            <SettingGroup name="Toolbar Customization" description="Use the arrows to reorder tools. Toggle to show/hide.">
                <ToolbarToolsGroup />
            </SettingGroup>

            <SettingGroup name="Camera options">
                <CameraOptionsSettings />
            </SettingGroup>
        </>
    );
}
