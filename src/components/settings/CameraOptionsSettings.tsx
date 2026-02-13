import React, { useCallback, useMemo } from "react";
import Setting from "./Setting";
import useUserPluginSettings from "src/hooks/useUserPluginSettings";
import useSettingsManager from "src/hooks/useSettingsManager";

const DEFAULT_ZOOM_STEPS = [0.1, 0.25, 0.5, 1, 2, 4, 8];

export default function CameraOptionsSettings() {
    const settingsManager = useSettingsManager();
    const settings = useUserPluginSettings(settingsManager);

    const wheelBehaviorOptions = useMemo(() => ({
        none: 'None',
        pan: 'Pan',
        zoom: 'Zoom',
    }), []);

    const onWheelBehaviorChange = useCallback((value: string) => {
        if (value !== 'none' && value !== 'pan' && value !== 'zoom') {
            console.error('Unable to updated wheelBehavior, invalid value:', { value })
            return;
        }
        settingsManager.updateEditorWheelBehavior(value);
    }, [settingsManager]);

    const onPanSpeedChange = useCallback((value: string) => {
        const parsed = Number.parseFloat(value);
        if (!Number.isFinite(parsed) || parsed <= 0) return;
        settingsManager.updateEditorPanSpeed(parsed);
    }, [settingsManager]);

    const onZoomSpeedChange = useCallback((value: string) => {
        const parsed = Number.parseFloat(value);
        if (!Number.isFinite(parsed) || parsed <= 0) return;
        settingsManager.updateEditorZoomSpeed(parsed);
    }, [settingsManager]);

    const resetPanSpeed = useCallback(() => {
        settingsManager.updateEditorPanSpeed(undefined);
    }, [settingsManager]);

    const resetZoomSpeed = useCallback(() => {
        settingsManager.updateEditorZoomSpeed(undefined);
    }, [settingsManager]);

    const zoomStepsValue = useMemo(() => {
        const steps = settings.cameraOptions?.zoomSteps;
        if (!steps || steps.length === 0) return '';
        return steps.join(', ');
    }, [settings.cameraOptions?.zoomSteps]);

    const onZoomStepsChange = useCallback((value: string) => {
        const parsed = value
            .split(',')
            .map((step) => Number.parseFloat(step.trim()))
            .filter((step) => Number.isFinite(step) && step > 0);

        if (parsed.length === 0) return;

        const uniqueSorted = Array.from(new Set(parsed)).sort((a, b) => a - b);
        settingsManager.updateEditorZoomSteps(uniqueSorted);
    }, [settingsManager]);

    const resetZoomSteps = useCallback(() => {
        settingsManager.updateEditorZoomSteps(undefined);
    }, [settingsManager]);

    return (
        <>
            <Setting
                slots={{
                    name: (
                        <>
                            Pan speed
                        </>
                    ),
                    desc: (
                        <>
                            Camera panning movement multiplier. Higher is faster.
                        </>
                    ),
                    control: (
                        <>
                            <Setting.Text
                                value={`${settings.cameraOptions?.panSpeed ?? ''}`}
                                placeholder="1"
                                onChange={onPanSpeedChange}
                            />
                            <Setting.ExtraButton
                                icon={'reset'}
                                tooltip={'reset'}
                                onClick={resetPanSpeed}
                            />
                        </>
                    )
                }}
            />
            <Setting
                slots={{
                    name: (
                        <>
                            Zoom speed
                        </>
                    ),
                    desc: (
                        <>
                            Camera zoom movement multiplier. Higher is faster.
                        </>
                    ),
                    control: (
                        <>
                            <Setting.Text
                                value={`${settings.cameraOptions?.zoomSpeed ?? ''}`}
                                placeholder="1"
                                onChange={onZoomSpeedChange}
                            />
                            <Setting.ExtraButton
                                icon={'reset'}
                                tooltip={'reset'}
                                onClick={resetZoomSpeed}
                            />
                        </>
                    )
                }}
            />
            <Setting
                slots={{
                    name: (
                        <>
                            Zoom steps
                        </>
                    ),
                    desc: (
                        <>
                            Comma-separated zoom levels (e.g. 0.25, 0.5, 1, 2). Fewer, wider steps feel faster when navigating large canvases.
                        </>
                    ),
                    control: (
                        <>
                            <Setting.Text
                                value={zoomStepsValue}
                                placeholder={DEFAULT_ZOOM_STEPS.join(', ')}
                                onChange={onZoomStepsChange}
                            />
                            <Setting.ExtraButton
                                icon={'reset'}
                                tooltip={'reset'}
                                onClick={resetZoomSteps}
                            />
                        </>
                    )
                }}
            />
            <Setting
                slots={{
                    name: (
                        <>
                            Scrolling behavior
                        </>
                    ),
                    desc: (
                        <>
                            How the scrolling input from the mouse wheel or the touchpad gesture should control the editor camera.
                        </>
                    ),
                    control: (
                        <>
                            <Setting.Dropdown
                                options={wheelBehaviorOptions}
                                value={settings.cameraOptions?.wheelBehavior ?? 'pan'}
                                onChange={onWheelBehaviorChange}
                            />
                        </>
                    )
                }}
            />
        </>
    )
}
