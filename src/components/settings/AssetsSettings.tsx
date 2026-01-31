import React, { useCallback } from "react";
import Setting from "./Setting";
import useSettingsManager from "src/hooks/useSettingsManager";
import useUserPluginSettings from "src/hooks/useUserPluginSettings";
import { DEFAULT_SETTINGS } from "src/obsidian/TldrawSettingsTab";

export default function AssetsSettings() {
    const settingsManager = useSettingsManager();
    const settings = useUserPluginSettings(settingsManager);

    const onAssetsFolderChanged = useCallback(async (value: string) => {
        settingsManager.settings.fileDestinations.assetsFolder = value;
        await settingsManager.updateSettings(settingsManager.settings);
    }, [settingsManager]);

    const resetAssetsFolder = useCallback(async () => {
        settingsManager.settings.fileDestinations.assetsFolder = DEFAULT_SETTINGS.fileDestinations.assetsFolder;
        await settingsManager.updateSettings(settingsManager.settings);
    }, [settingsManager]);

    return (
        <Setting.Container>
            <Setting
                slots={{
                    name: "Assets Folder",
                    desc: (
                        <>
                            The location where tldraw assets (images, videos, etc.) will be downloaded to.
                            <code className="ptl-default-code">
                                DEFAULT: {DEFAULT_SETTINGS.fileDestinations.assetsFolder}
                            </code>
                        </>
                    ),
                    control: (
                        <>
                            <Setting.Text
                                placeholder={DEFAULT_SETTINGS.fileDestinations.assetsFolder}
                                value={settings.fileDestinations.assetsFolder}
                                onChange={onAssetsFolderChanged}
                            />
                            <Setting.ExtraButton
                                icon={'reset'}
                                onClick={resetAssetsFolder}
                            />
                        </>
                    ),
                }}
            />
        </Setting.Container>
    );
}
