import React, { ComponentPropsWithoutRef, memo, useCallback, useEffect, useMemo, useState } from "react";
import useUserPluginSettings from "src/hooks/useUserPluginSettings";
import Setting from "./Setting";
import { validateFolderPath } from "src/obsidian/helpers/app";
import { IconName, setIcon, TFolder } from "obsidian";
import { DEFAULT_SETTINGS, DestinationMethod } from "src/obsidian/TldrawSettingsTab";
import { DEFAULT_SAVE_DELAY, MIN_SAVE_DELAY, MAX_SAVE_DELAY, FRONTMATTER_KEY } from "src/utils/constants";
import { clamp, msToSeconds } from "src/utils/utils";
import UserSettingsManager from "src/obsidian/settings/UserSettingsManager";
import useSettingsManager from "src/hooks/useSettingsManager";
import { destinationMethods, destinationMethodsRecord } from "src/obsidian/settings/constants";
import { isValidFrontmatterTag } from "src/obsidian/helpers/front-matter";

const DEFAULT_TAGS = ['tldraw']

function FileSettingsGroup() {
    const settingsManager = useSettingsManager();
    const settings = useUserPluginSettings(settingsManager);

    const onColocationSubfolderChanged = useCallback(async (value: string) => {
        const folder = value === '' ? '' : validateFolderPath(settingsManager.plugin.app, value)
        if (folder !== '' && !folder) return;
        settingsManager.settings.fileDestinations.colocationSubfolder = folder instanceof TFolder
            ? folder.path : folder
            ;
        await settingsManager.updateSettings(settingsManager.settings);
    }, [settingsManager])

    const FileDestinationMethodDesc = useCallback(memo(function FileDestinationMethodDesc({
        method,
    }: {
        method: typeof settings.fileDestinations.destinationMethod,
    }) {
        const settings = useUserPluginSettings(settingsManager);
        const {
            desc,
            destination,
        } = ((): {
            desc: string,
            destination: string,
        } => {
            switch (method) {
                case "attachments-folder": return {
                    desc: "Use the location defined in the \"Files and links\" options tab for newly created tldraw files if they are embed as an attachment.",
                    destination: settingsManager.plugin.app.vault.config.attachmentFolderPath ?? '/',
                };
                case "colocate": return {
                    desc: "Place files in the same directory as the active note/file. You can also optionally define a subfolder within that directory below.",
                    destination: './' + settings.fileDestinations.colocationSubfolder,
                };
                case "default-folder": return {
                    desc: "Use the default folder from below.",
                    destination: settings.fileDestinations.defaultFolder,
                };
            }
        })();
        return (
            <>
                The method to use for all new tldraw files.
                <div>
                    {desc}
                </div>
                <code className="ptl-default-code">
                    Destination: {destination}
                </code>
            </>
        );
    }), [settingsManager]);

    const updateDestinationMethod = useCallback(async (method: string) => {
        if (!(destinationMethods as readonly string[]).includes(method)) return;
        settingsManager.settings.fileDestinations.destinationMethod = method as DestinationMethod;
        await settingsManager.updateSettings(settingsManager.settings);
    }, [settingsManager]);

    const resetDestinationMethod = useCallback(() => (
        updateDestinationMethod(DEFAULT_SETTINGS.fileDestinations.destinationMethod)
    ), [updateDestinationMethod]);

    const onDefaultFolderChanged = useCallback(async (value: string) => {
        settingsManager.settings.fileDestinations.defaultFolder = value;
        await settingsManager.updateSettings(settingsManager.settings);
    }, [settingsManager]);

    const onConfirmDestinationChanged = useCallback(async (confirm: boolean) => {
        settingsManager.settings.fileDestinations.confirmDestination = confirm;
        await settingsManager.updateSettings(settingsManager.settings);
    }, [settingsManager]);

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

    const onPrefixChanged = useCallback(async (value: string) => {
        settingsManager.settings.newFilePrefix = value;
        await settingsManager.updateSettings(settingsManager.settings);
    }, [settingsManager]);

    return (
        <>
            <Setting
                slots={{
                    name: 'File destination method',
                    desc: <FileDestinationMethodDesc method={settings.fileDestinations.destinationMethod} />,
                    control: (
                        <>
                            <Setting.Dropdown
                                options={destinationMethodsRecord}
                                value={settings.fileDestinations.destinationMethod}
                                onChange={updateDestinationMethod}
                            />
                            <Setting.ExtraButton
                                icon={'reset'}
                                onClick={resetDestinationMethod}
                            />
                        </>
                    )
                }}
            />
            <Setting
                slots={{
                    name: 'Colocation subfolder',
                    desc: 'The folder to use when using the colocation destination. Leave this blank to use the same folder as the current active file.',
                    control: (
                        <>
                            <Setting.Text
                                value={settings.fileDestinations.colocationSubfolder}
                                onChange={onColocationSubfolderChanged}
                            />
                        </>
                    )
                }}
            />
            <Setting
                slots={{
                    name: 'Default folder',
                    desc: (
                        `The folder to create new tldraw files in when the destination method is set to ${destinationMethodsRecord['default-folder']
                        }, and the folder to show when the "Confirm destination" option is toggled.`
                    ),
                    control: (
                        <>
                            <Setting.Text
                                placeholder="root"
                                value={settings.fileDestinations.defaultFolder}
                                onChange={onDefaultFolderChanged}
                            />
                        </>
                    )
                }}
            />
            <Setting
                slots={{
                    name: 'Confirm destination',
                    desc: 'Show a pop-up modal that allows confirming or editing the destination and choosing another destination method.',
                    control: (
                        <>
                            <Setting.Toggle
                                value={settings.fileDestinations.confirmDestination}
                                onChange={onConfirmDestinationChanged}
                            />
                        </>
                    ),
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
                    name: 'New file prefix',
                    desc: (
                        <>
                            {'When creating a new tldraw file, the file name will automatically prepend the prefix. Can be left empty, however if both the prefix and time format are empty, it will use the defaults to name the file.'}
                            <code className="ptl-default-code">
                                {`DEFAULT: [${DEFAULT_SETTINGS.newFilePrefix} ]`}
                            </code>
                        </>
                    ),
                    control: (
                        <>
                            <Setting.Text
                                placeholder="Prefix"
                                value={settings.newFilePrefix}
                                onChange={onPrefixChanged}
                            />
                        </>
                    )
                }}
            />
            <NewFileTimeFormat settingsManager={settingsManager} />
        </>
    )
}

function NewFileTimeFormat({
    settingsManager,
}: {
    settingsManager: UserSettingsManager,
}) {
    const settings = useUserPluginSettings(settingsManager);
    const [sampleEl, setSampleEl] = useState<HTMLSpanElement | null>(null);
    const onChange = useCallback(async (value: string) => {
        settingsManager.settings.newFileTimeFormat = value;
        await settingsManager.updateSettings(settingsManager.settings);
    }, [settingsManager]);
    const onResetClick = useCallback(async () => {
        settingsManager.settings.newFileTimeFormat = DEFAULT_SETTINGS.newFileTimeFormat;
        await settingsManager.updateSettings(settingsManager.settings);
    }, [settingsManager]);
    return (
        <>
            <Setting
                slots={{
                    name: 'New file time format',
                    desc: (
                        <>
                            {'When creating a new tldraw file, this represents the time format that will get appended to the file name. It can be left empty, however if both the Prefix and Time Format are empty, it will use the defaults to name the file. '}
                            <a href="https://momentjs.com/docs/#/displaying/format/">Date Format Reference</a>
                            <div>
                                Preview: <span ref={setSampleEl} />
                            </div>
                        </>
                    ),
                    control: (
                        <>
                            <Setting.MomentFormat
                                defaultFormat={DEFAULT_SETTINGS.newFileTimeFormat}
                                placeholder={DEFAULT_SETTINGS.newFileTimeFormat}
                                value={settings.newFileTimeFormat}
                                sampleEl={sampleEl ?? undefined}
                                onChange={onChange}
                            />
                            <Setting.ExtraButton
                                icon={'reset'}
                                tooltip={'reset'}
                                onClick={onResetClick}
                            />
                        </>
                    ),
                }}
            />
        </>
    )
}

function FrontmatterSettingsGroup() {
    const settingsManager = useSettingsManager();
    const settings = useUserPluginSettings(settingsManager);

    const updateFrontmatterKey = useCallback(async (key?: string) => {
        if (!key) {
            delete settingsManager.settings.file?.altFrontmatterKey;
        } else {
            if (!settingsManager.settings.file) {
                settingsManager.settings.file = {};
            }
            settingsManager.settings.file.altFrontmatterKey = key;
        }
        await settingsManager.updateSettings(settingsManager.settings);
    }, [settingsManager]);

    const resetFrontmatterKey = useCallback(() => (
        updateFrontmatterKey(undefined)
    ), [updateFrontmatterKey]);

    const onInsertTags = useCallback(async (insertTags: boolean) => {
        if (!settingsManager.settings.file) {
            settingsManager.settings.file = {};
        }
        settingsManager.settings.file.insertTags = insertTags;
        await settingsManager.updateSettings(settingsManager.settings);
    }, [settingsManager])

    const updateFrontmatterTags = useCallback(async (tags?: string[]) => {
        if (tags === undefined) {
            delete settingsManager.settings.file?.customTags;
        } else {
            if (!settingsManager.settings.file) {
                settingsManager.settings.file = {};
            }
            settingsManager.settings.file.customTags = [...new Set(tags)];
        }
        await settingsManager.updateSettings(settingsManager.settings);
    }, [settingsManager]);

    const resetFrontmatterTags = useCallback(() => (
        updateFrontmatterTags(undefined)
    ), [updateFrontmatterTags]);

    const [frontmatterTagValue, setFrontmatterTagValue] = useState('');

    const isInvalidFrontmatterTag = useMemo(
        () => !isValidFrontmatterTag(frontmatterTagValue),
        [frontmatterTagValue]
    );

    const addFrontmatterTag = useCallback(() => {
        const tags = settings.file?.customTags ?? [...DEFAULT_TAGS];
        if (!isValidFrontmatterTag(frontmatterTagValue)) return;
        tags.push(frontmatterTagValue)
        updateFrontmatterTags(tags);
        setFrontmatterTagValue('');
    }, [updateFrontmatterTags, settings, frontmatterTagValue]);

    const defaultTagsRemove = useCallback(async (tag: string) => {
        const tags = DEFAULT_TAGS.filter((e) => e !== tag);
        await updateFrontmatterTags(tags);
    }, [updateFrontmatterTags]);

    const makeFrontmatterTag = useCallback((tag: string) => {
        const tags = settings.file?.customTags;
        return (
            <div key={tag} className="ptl-settings-frontmatter-tag multi-select-pill">
                <div className="multi-select-pill-content">
                    <span>{tag}</span>
                </div>
                <IconButton
                    className="multi-select-pill-remove-button"
                    iconId={'x'}
                    onClick={tags === undefined
                        ? () => defaultTagsRemove(tag)
                        : () => updateFrontmatterTags(tags.filter((e) => e !== tag))}
                />
            </div>
        );
    }, [defaultTagsRemove, settings]);

    return (
        <>
            <Setting
                slots={{
                    name: 'Frontmatter',
                }}
                heading={true}
            />
            <Setting
                slots={{
                    name: 'Alternative frontmatter key',
                    desc: (
                        <>
                            An alternative key to use to determine if a markdown file is a tldraw document.
                            This key will be added to every new tldraw markdown file.
                            <code className="ptl-default-code">
                                {`DEFAULT: ${FRONTMATTER_KEY}`}
                            </code>
                        </>
                    ),
                    control: (
                        <>
                            <Setting.Text
                                value={settings.file?.altFrontmatterKey}
                                placeholder={FRONTMATTER_KEY}
                                onChange={updateFrontmatterKey}
                            />
                            <Setting.ExtraButton
                                icon={'reset'}
                                onClick={resetFrontmatterKey}
                            />
                        </>
                    )
                }}
            />
            <Setting
                slots={{
                    name: 'Insert tags',
                    desc: (
                        <>
                            Insert tags into new tldraw markdown documents.
                            <code className="ptl-default-code">
                                DEFAULT: {DEFAULT_SETTINGS.workspace.switchMarkdownView ? 'On' : 'Off'}
                            </code>
                        </>
                    ),
                    control: (
                        <>
                            <Setting.Toggle
                                value={settings.file?.insertTags ?? DEFAULT_SETTINGS.file.insertTags}
                                onChange={onInsertTags}
                            />
                        </>
                    )
                }}
            />
            <Setting
                slots={{
                    name: 'Tags',
                    desc: (
                        <>
                            <p>
                                The tags to insert in new tldraw markdown documents.
                                See <a href="https://help.obsidian.md/tags#Tag+format">Tags documentation</a> for what is considered a valid tag.
                                <code className="ptl-default-code">
                                    {`DEFAULT: ${DEFAULT_TAGS.join(', ')}`}
                                </code>
                            </p>
                            <div className="ptl-settings-frontmatter-taglist">
                                {
                                    settings.file?.customTags?.map(makeFrontmatterTag) ?? (
                                        <>
                                            {DEFAULT_TAGS.map(makeFrontmatterTag)}
                                        </>
                                    )
                                }
                            </div>
                        </>
                    ),
                    control: (
                        <>
                            <IconButton className="clickable-icon extra-setting-button"
                                iconId="rotate-ccw"
                                aria-label="Reset to default"
                                onClick={resetFrontmatterTags}
                            />
                        </>
                    )
                }}
            />
            <Setting.Container>
                <Setting
                    slots={{
                        name: 'New tag',
                        desc: (
                            <>
                                {
                                    !frontmatterTagValue.length || !isInvalidFrontmatterTag ? undefined : (
                                        <>
                                            <p style={{ color: 'red' }}>Invalid frontmatter tag</p>
                                        </>
                                    )
                                }
                            </>
                        ),
                        control: (
                            <>
                                <Setting.Text
                                    value={frontmatterTagValue}
                                    placeholder={'custom-tag'}
                                    onChange={setFrontmatterTagValue}
                                />
                                <Setting.ExtraButton
                                    icon={'plus-circle'}
                                    onClick={addFrontmatterTag}
                                />
                            </>
                        ),
                    }}
                />
            </Setting.Container>
        </>
    )
}

function IconButton({ iconId, ...rest }: Omit<ComponentPropsWithoutRef<'div'>, 'children'> & {
    iconId: IconName,
}) {
    const [ref, setRef] = useState<HTMLDivElement | null>();
    useEffect(() => {
        if (!ref) return;
        setIcon(ref, iconId);
    });
    return <div ref={setRef} {...rest} />;
}

export default function FileSettings() {
    return (
        <>
            <Setting.Container>
                <FileSettingsGroup />
                <FrontmatterSettingsGroup />
            </Setting.Container>
        </>
    );
}