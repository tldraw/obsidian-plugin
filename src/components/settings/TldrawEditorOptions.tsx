import React, { useCallback, useMemo } from "react";
import Setting from "./Setting";
import SettingGroup from "./SettingGroup";
import CameraOptionsSettings from "./CameraOptionsSettings";
import useSettingsManager from "src/hooks/useSettingsManager";
import useUserPluginSettings from "src/hooks/useUserPluginSettings";
import { defaultTldrawOptions } from "tldraw";
import { DEFAULT_SETTINGS } from "src/obsidian/TldrawSettingsTab";
import { DEFAULT_SAVE_DELAY, MIN_SAVE_DELAY, MAX_SAVE_DELAY, MIN_STROKE_SIZE, MAX_STROKE_SIZE } from "src/utils/constants";
import { clamp, msToSeconds } from "src/utils/utils";

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

    const onToolbarOrientationChange = useCallback(async (value: string) => {
        if (value !== 'vertical' && value !== 'horizontal') return;
        await settingsManager.updateSettings({
            ...settings,
            tldrawOptions: {
                ...settings.tldrawOptions,
                toolbarOrientation: value
            }
        });
    }, [settingsManager, settings]);

    const defaultDelay = msToSeconds(DEFAULT_SAVE_DELAY);
    const minDelay = msToSeconds(MIN_SAVE_DELAY);
    const maxDelay = msToSeconds(MAX_SAVE_DELAY);

    const onSaveFileDelayChanged = useCallback(async (value: string) => {
        const parsedValue = parseFloat(value);
        if (isNaN(parsedValue) && value) return;
        settingsManager.settings.saveFileDelay = clamp(
            parsedValue || defaultDelay,
            minDelay,
            maxDelay
        );
        await settingsManager.updateSettings(settingsManager.settings);
    }, [settingsManager]);

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
            <Setting
                slots={{
                    name: 'Toolbar orientation',
                    desc: 'Whether the toolbar should be vertical or horizontal.',
                    control: (
                        <select
                            value={settings.tldrawOptions?.toolbarOrientation ?? 'horizontal'}
                            onChange={(e) => onToolbarOrientationChange(e.target.value)}
                            className="dropdown"
                        >
                            <option value="horizontal">Horizontal</option>
                            <option value="vertical">Vertical</option>
                        </select>
                    )
                }}
            />
            <Setting
                slots={{
                    name: 'Save delay',
                    desc: (
                        <>
                            {`The delay in seconds to automatically save after a change has been made to a tlraw drawing. Must be a value between ${minDelay} and ${maxDelay} (1 hour). Requires reloading any tldraw files you may have open in a tab.`}
                            <code className="ptl-default-code">
                                {`DEFAULT: [${DEFAULT_SETTINGS.saveFileDelay}]`}
                            </code>
                        </>
                    ),
                    control: (
                        <>
                            <Setting.Text
                                placeholder={`${defaultDelay}`}
                                value={`${settings.saveFileDelay}`}
                                onChange={onSaveFileDelayChanged}
                            />
                        </>
                    )
                }}
            />
            <Setting
                slots={{
                    name: 'Reduce quality during zoom',
                    desc: 'Improve performance by hiding complex elements (like the grid and selection handles) while zooming or panning with the trackpad.',
                    control: (
                        <Setting.Toggle
                            value={!!settings.tldrawOptions?.lowQualityDuringZoom}
                            onChange={async (val) => {
                                await settingsManager.updateSettings({
                                    ...settings,
                                    tldrawOptions: {
                                        ...settings.tldrawOptions,
                                        lowQualityDuringZoom: val
                                    }
                                });
                            }}
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
    const strokeSizes = useMemo(() => ({
        s: 0.1, m: 0.3, l: 0.6, xl: 1.2,
        ...settings.tldrawOptions?.strokeSizes
    }), [settings.tldrawOptions?.strokeSizes]);

    const [localSizes, setLocalSizes] = React.useState<Record<string, string>>({
        s: String(strokeSizes.s),
        m: String(strokeSizes.m),
        l: String(strokeSizes.l),
        xl: String(strokeSizes.xl),
    });

    React.useEffect(() => {
        setLocalSizes({
            s: String(strokeSizes.s),
            m: String(strokeSizes.m),
            l: String(strokeSizes.l),
            xl: String(strokeSizes.xl),
        });
    }, [strokeSizes]);

    const handleLocalSizeChange = (key: string, val: string) => {
        setLocalSizes(prev => ({ ...prev, [key]: val }));
    };

    const saveStrokeSize = useCallback(async (key: string) => {
        const val = localSizes[key];
        const num = parseFloat(val);
        if (isNaN(num)) {
            // Reset to current setting if invalid
            setLocalSizes(prev => ({ ...prev, [key]: String((strokeSizes as any)[key]) }));
            return;
        }
        const clampedNum = clamp(num, MIN_STROKE_SIZE, MAX_STROKE_SIZE);

        await settingsManager.updateSettings({
            ...settings,
            tldrawOptions: {
                ...settings.tldrawOptions,
                strokeSizes: {
                    s: 0.1, m: 0.3, l: 0.6, xl: 1.2,
                    ...settings.tldrawOptions?.strokeSizes,
                    [key]: clampedNum
                }
            }
        });

        // Update local state to the clamped value
        setLocalSizes(prev => ({ ...prev, [key]: String(clampedNum) }));
    }, [localSizes, settings, settingsManager, strokeSizes]);

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
                    desc: (
                        <>
                            {`Customize the thickness for S, M, L, XL sizes. Must be a value between ${MIN_STROKE_SIZE} and ${MAX_STROKE_SIZE}.`}
                        </>
                    ),
                    control: (
                        <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                            {Object.entries(localSizes).map(([key, val]) => (
                                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ width: '20px', textTransform: 'uppercase' }}>{key}</span>
                                    <input
                                        type="text"
                                        value={val}
                                        onChange={(e) => handleLocalSizeChange(key, e.target.value)}
                                        onBlur={() => saveStrokeSize(key)}
                                        style={{ width: '60px' }}
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
