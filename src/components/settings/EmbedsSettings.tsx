import React, { useCallback } from "react";
import Setting from "./Setting";
import useSettingsManager from "src/hooks/useSettingsManager";
import useUserPluginSettings from "src/hooks/useUserPluginSettings";
import { DEFAULT_SETTINGS } from "src/obsidian/TldrawSettingsTab";

export default function EmbedsSettings() {
    const settingsManager = useSettingsManager();
    const settings = useUserPluginSettings(settingsManager);

    const onPaddingChange = useCallback(async (value: string) => {
        const parsedValue = parseInt(value);
        if (isNaN(parsedValue)) return;

        await settingsManager.updateSettings({
            ...settings,
            embeds: {
                ...settings.embeds,
                padding: parsedValue
            }
        });
    }, [settings, settingsManager]);

    const onShowBgChange = useCallback(async (value: boolean) => {
        await settingsManager.updateSettings({
            ...settings,
            embeds: {
                ...settings.embeds,
                showBg: value
            }
        });
    }, [settings, settingsManager]);

    const onShowBgDotsChange = useCallback(async (value: boolean) => {
        await settingsManager.updateSettings({
            ...settings,
            embeds: {
                ...settings.embeds,
                showBgDots: value
            }
        });
    }, [settings, settingsManager]);

    return (
        <Setting.Container>
            <Setting
                slots={{
                    name: "Padding",
                    desc: (
                        <>
                            Padding for the embed view in pixels.
                            <code className="ptl-default-code">
                                DEFAULT: {DEFAULT_SETTINGS.embeds.padding}
                            </code>
                        </>
                    ),
                    control: (
                        <Setting.Text
                            placeholder={DEFAULT_SETTINGS.embeds.padding.toString()}
                            value={settings.embeds.padding.toString()}
                            onChange={onPaddingChange}
                        />
                    ),
                }}
            />
            <Setting
                slots={{
                    name: "Show Background",
                    desc: (
                        <>
                            Show the background for markdown embeds.
                            <code className="ptl-default-code">
                                DEFAULT: {DEFAULT_SETTINGS.embeds.showBg ? "On" : "Off"}
                            </code>
                        </>
                    ),
                    control: (
                        <Setting.Toggle
                            value={settings.embeds.showBg}
                            onChange={onShowBgChange}
                        />
                    ),
                }}
            />
            <Setting
                slots={{
                    name: "Show Background Dots",
                    desc: (
                        <>
                            Show the background dotted pattern for markdown embeds.
                            <code className="ptl-default-code">
                                DEFAULT: {DEFAULT_SETTINGS.embeds.showBgDots ? "On" : "Off"}
                            </code>
                        </>
                    ),
                    control: (
                        <Setting.Toggle
                            value={settings.embeds.showBgDots}
                            onChange={onShowBgDotsChange}
                        />
                    ),
                }}
            />
        </Setting.Container>
    );
}
