import { Container } from '@obsidian-plugin-toolkit/react'
import { Button, ExtraButton, Modal, Text } from '@obsidian-plugin-toolkit/react/components'
import { Group, Setting } from '@obsidian-plugin-toolkit/react/components/setting/group'
import { Notice, TFile, TFolder } from 'obsidian'
import React, {
	ComponentProps,
	memo,
	useCallback,
	useMemo,
	useState,
	useSyncExternalStore,
} from 'react'
import useSettingsManager from 'src/plugin/app/hooks/useSettingsManager'
import useUserPluginSettings from 'src/plugin/app/hooks/useUserPluginSettings'
import DownloadManagerModal from 'src/obsidian/download/DownloadManagerModal'
import { FileSearchModal } from 'src/plugin/modals/FileSearchModal'
import {
	defaultFonts,
	fontExtensions,
	FontGroupMatcher,
	iconExtensions,
	iconTypes,
} from 'src/plugin/settings/constants'
import FontsSettingsManager from 'src/plugin/settings/FontsSettingsManager'
import IconsSettingsManager from 'src/plugin/settings/IconsSettingsManager'
import { tldrawNpmAssetsBrowseUrl } from 'src/plugin/settings/tldrawNpmAssets'
import { FontTypes, IconNames } from 'src/plugin/settings/overrides-types'
import { DownloadInfo } from 'src/obsidian/download/download'
import { ErrorHandler } from 'src/plugin/error-handler'

function AssetsSettingsGroup({ downloadAll }: { downloadAll: () => void }) {
	const settingsManager = useSettingsManager()
	const settings = useUserPluginSettings(settingsManager)
	return (
		<>
			<Setting
				slots={{
					name: 'All assets download',
					desc: (
						<>
							{'Download all assets for offline use'}
							<code className="ptl-default-code">
								{`Vault folder: ${settings.fileDestinations.assetsFolder}`}
							</code>
						</>
					),
					control: (
						<>
							<Button onClick={downloadAll}>Download all</Button>
						</>
					),
				}}
			/>
		</>
	)
}

function FontAssetsSettingsGroup({ downloadAll }: { downloadAll: () => void }) {
	const settingsManager = useSettingsManager()
	const settings = useUserPluginSettings(settingsManager)
	return (
		<>
			<Setting
				slots={{
					name: 'Fonts download',
					desc: (
						<>
							{'Download all fonts for offline use'}
							<code className="ptl-default-code">
								{`Vault folder: ${settings.fileDestinations.assetsFolder}/fonts`}
							</code>
						</>
					),
					control: (
						<>
							<Button onClick={downloadAll}>Download all</Button>
						</>
					),
				}}
			/>
		</>
	)
}

function IconAssetsSettingsGroup({
	downloadAll,
	manager,
}: {
	downloadAll: () => void
	manager: IconsSettingsManager
}) {
	return (
		<>
			<Setting
				slots={{
					name: 'Icons download',
					desc: (
						<>
							{'Download all icons for offline use'}
							<code className="ptl-default-code">
								{`Vault folder: ${manager.plugin.settingsManager.settings.fileDestinations.assetsFolder}/icons`}
							</code>
						</>
					),
					control: (
						<>
							<Button onClick={downloadAll}>Download all</Button>
						</>
					),
				}}
			/>
		</>
	)
}

const MemoAssetsSettingsGroup = memo(function MemoAssetsSettingsGroup({
	downloadAll,
}: Pick<ComponentProps<typeof AssetsSettingsGroup>, 'downloadAll'>) {
	return (
		<>
			<AssetsSettingsGroup downloadAll={downloadAll} />
		</>
	)
})

function FontOverrideSetting({
	downloadFont,
	manager,
	font,
}: {
	downloadFont: (font: FontTypes, config: DownloadInfo) => void
	manager: FontsSettingsManager
	font: FontTypes
}) {
	const store = useMemo(
		() => ({
			getCurrent: () => manager.overrides[font],
			subscribe: (cb: () => void) => manager.onChanged(font, cb),
		}),
		[manager, font]
	)

	const current = useSyncExternalStore(store.subscribe, store.getCurrent)

	const onFileSearchClick = useCallback(() => {
		new FileSearchModal(manager.plugin, {
			extensions: [...fontExtensions],
			initialSearchPath: store.getCurrent(),
			onEmptyStateText: (searchPath) => `No folders or fonts at "${searchPath}".`,
			setSelection: (file) => {
				if (!(file instanceof TFile)) {
					const path = typeof file === 'string' ? file : file.path
					new Notice(`"${path}" is not a valid file.`)
					return
				}
				manager.setFontPath(font, file.path).catch(ErrorHandler.notice)
			},
		}).open()
	}, [manager, store, font])

	const resetFont = useCallback(() => manager.setFontPath(font, null), [font, manager])

	const fontConfig = useMemo(() => manager.getDownloadConfig(font), [manager, font])

	const download = useCallback(
		() => downloadFont(font, fontConfig),
		[font, fontConfig, downloadFont]
	)

	const href = tldrawNpmAssetsBrowseUrl(`fonts/${defaultFonts[font]}`)
	return (
		<>
			<Setting
				slots={{
					name: (
						<a href={href} title={href}>
							{font}
						</a>
					),
					control: (
						<>
							<Text value={current ?? ''} placeholder="[ DEFAULT ]" readonly={true} />
							<Button icon={'file-search'} onClick={onFileSearchClick} />
							<ExtraButton
								icon={'download'}
								tooltip={`Download from ${fontConfig.url}`}
								onClick={download}
							/>
							<ExtraButton
								icon={'rotate-ccw'}
								tooltip={'Use default'}
								disabled={!current}
								onClick={resetFont}
							/>
						</>
					),
				}}
			/>
		</>
	)
}

const fontOverrideSettingProps = [
	{
		name: 'Draw (handwriting) font',
		group: '_draw',
		appearsAs: 'draw',
	},
	{
		name: 'Sans-serif font',
		group: '_sans',
		appearsAs: 'sans',
	},
	{
		name: 'Serif font',
		group: '_serif',
		appearsAs: 'serif',
	},
	{
		name: 'Monospace font',
		group: '_mono',
		appearsAs: 'mono',
	},
] satisfies {
	name: string
	group: FontGroupMatcher
	appearsAs: string
}[]

const MemoFontAssetsSettingsGroup = memo(
	({
		downloadFont,
		manager,
	}: {
		downloadFont: (font: FontTypes, config: DownloadInfo) => void
		manager: FontsSettingsManager
	}) => {
		return (
			<>
				<Group heading="Font assets overrides">
					{fontOverrideSettingProps.map(({ group, name, appearsAs }) => (
						<Setting
							key={group}
							slots={{
								name: name,
								desc: `Appears as "${appearsAs}" in the style panel.`,
								control: (
									<FontOverrideSettingGroup
										group={group}
										manager={manager}
										downloadFont={downloadFont}
									/>
								),
							}}
						/>
					))}
				</Group>
			</>
		)
	}
)

function FontOverrideSettingGroup({
	group,
	manager,
	downloadFont,
}: {
	group: FontGroupMatcher
	manager: FontsSettingsManager
	downloadFont: (font: FontTypes, config: DownloadInfo) => void
}) {
	const [isOpen, setIsOpen] = useState(false)
	return (
		<>
			<Button onClick={() => setIsOpen(true)}>Manage overrides</Button>
			<Modal key={group} modalProps={manager.plugin} open={isOpen} onClose={() => setIsOpen(false)}>
				<Group heading={`Font overrides for ${group}`}>
					{Object.keys(defaultFonts)
						.filter((key) => key.includes(group))
						.map((key) => (
							<FontOverrideSetting
								key={key}
								downloadFont={downloadFont}
								manager={manager}
								font={key as keyof typeof defaultFonts}
							/>
						))}
				</Group>
			</Modal>
		</>
	)
}
function IconSetSetting({ manager }: { manager: IconsSettingsManager }) {
	const onFileSearchClick = useCallback(() => {
		new FileSearchModal(manager.plugin, {
			setSelection: (file) => {
				if (!(file instanceof TFolder)) return
				const updates: NonNullable<Parameters<typeof manager.saveIconSettings>[0]> = {}
				for (const child of file.children) {
					if (!(child instanceof TFile)) continue

					if (
						(iconExtensions as readonly string[]).includes(child.extension) &&
						(iconTypes as readonly string[]).includes(child.basename)
					) {
						updates[child.basename as IconNames] = child.path
					}
				}
				manager
					.saveIconSettings(updates)
					.then(() => {
						new Notice(`Updated icon overrides for ${Object.entries(updates).length}`)
					})
					.catch(ErrorHandler.notice)
			},
			selectDir: true,
			extensions: [],
			onEmptyStateText: (searchPath) => `No folders found at "${searchPath}"`,
		}).open()
	}, [manager])

	const clearAllOverrides = useCallback(() => manager.saveIconSettings(null), [manager])

	return (
		<>
			<Setting
				slots={{
					name: 'Use icon set',
					desc: 'Select a folder to load an icon set from. This option will only update an override if an icon name in the provided folder matches one of the names below.',
					control: (
						<>
							<Button icon={'file-search'} onClick={onFileSearchClick} />
							<ExtraButton
								icon={'rotate-ccw'}
								tooltip={'Clear all overrides'}
								onClick={clearAllOverrides}
							/>
						</>
					),
				}}
			/>
		</>
	)
}

function IconOverrideSetting({
	downloadIcon,
	manager,
	icon,
}: {
	downloadIcon: (icon: IconNames, config: DownloadInfo) => void
	manager: IconsSettingsManager
	icon: IconNames
}) {
	const store = useMemo(
		() => ({
			getCurrent: () => manager.overrides[icon],
			subscribe: (cb: () => void) => manager.onChanged(icon, cb),
		}),
		[manager, icon]
	)

	const current = useSyncExternalStore(store.subscribe, store.getCurrent)

	const onFileSearchClick = useCallback(() => {
		new FileSearchModal(manager.plugin, {
			extensions: [...iconExtensions],
			initialSearchPath: store.getCurrent(),
			onEmptyStateText: (searchPath) => `No folders or icons found at "${searchPath}".`,
			setSelection: (file) => {
				if (!(file instanceof TFile)) {
					const path = typeof file === 'string' ? file : file.path
					new Notice(`"${path}" is not a valid file.`)
					return
				}
				manager.setIconPath(icon, file.path).catch(ErrorHandler.notice)
			},
		}).open()
	}, [manager, store, icon])

	const resetIcon = useCallback(() => manager.setIconPath(icon, null), [icon, manager])

	const iconConfig = useMemo(() => manager.getDownloadConfig(icon), [manager, icon])

	const download = useCallback(
		() => downloadIcon(icon, iconConfig),
		[icon, iconConfig, downloadIcon]
	)

	const href = tldrawNpmAssetsBrowseUrl(`icons/icon/${icon}.svg`)

	return (
		<>
			<Setting
				slots={{
					name: (
						<a href={href} title={href}>
							{icon}
						</a>
					),
					control: (
						<>
							<Text value={current ?? ''} placeholder="[ DEFAULT ]" readonly={true} />
							<Button icon={'file-search'} onClick={onFileSearchClick} />
							<ExtraButton
								icon={'download'}
								tooltip={`Download from ${iconConfig.url}`}
								onClick={download}
							/>
							<ExtraButton
								icon={'rotate-ccw'}
								tooltip={'Use default'}
								disabled={!current}
								onClick={resetIcon}
							/>
						</>
					),
				}}
			/>
		</>
	)
}

const MemoIconAssetsSettingsGroup = memo(function MemoIconAssetsSettingsGroup({
	downloadIcon,
	manager,
}: {
	downloadIcon: (icon: IconNames, config: DownloadInfo) => void
	manager: IconsSettingsManager
}) {
	const [isOpen, setIsOpen] = useState(false)
	return (
		<>
			<Container>
				<IconSetSetting manager={manager} />
			</Container>
			<Setting
				slots={{
					name: 'Individual icon overrides',
					desc: (
						<>
							Click an icon name to view the default in your web browser. All of the default icons
							are available to browse on{' '}
							<a
								href={tldrawNpmAssetsBrowseUrl('icons/icon')}
							>
								{"tldraw's GitHub repository"}
							</a>
							.
						</>
					),
					control: (
						<>
							<Button onClick={() => setIsOpen(true)}>Manage overrides</Button>
							<Modal modalProps={manager.plugin} open={isOpen} onClose={() => setIsOpen(false)}>
								<Group heading={`Icon overrides`}>
									{iconTypes.map((e) => (
										<IconOverrideSetting
											key={e}
											icon={e}
											manager={manager}
											downloadIcon={downloadIcon}
										/>
									))}
								</Group>
							</Modal>
						</>
					),
				}}
			/>
		</>
	)
})

export default function AssetsSettings() {
	const settingsManager = useSettingsManager()

	const assetManagers = useMemo(
		() => ({
			fonts: new FontsSettingsManager(settingsManager.plugin),
			icons: new IconsSettingsManager(settingsManager.plugin),
			downloads: new DownloadManagerModal(settingsManager.plugin.app),
		}),
		[settingsManager]
	)

	const downloadFont = useCallback(
		(font: FontTypes, config: DownloadInfo) =>
			assetManagers.downloads.startDownload(config, async (tFile) =>
				assetManagers.fonts.setFontPath(font, tFile.path)
			),
		[assetManagers]
	)

	const downloadIcon = useCallback(
		(icon: IconNames, config: DownloadInfo) =>
			assetManagers.downloads.startDownload(config, async (tFile) =>
				assetManagers.icons.setIconPath(icon, tFile.path)
			),
		[assetManagers]
	)

	const downloadAllFonts = useCallback(async () => {
		const configs = assetManagers.fonts.getAllAssetsConfigs()
		for (const [font, downloadInfo] of configs) {
			await downloadFont(font, downloadInfo)
		}
	}, [assetManagers, downloadFont])

	const downloadAllIcons = useCallback(async () => {
		const configs = assetManagers.icons.getAllDownloadConfigs()
		for (const [icon, downloadInfo] of configs) {
			await downloadIcon(icon, downloadInfo)
		}
	}, [assetManagers, downloadIcon])

	const downloadAll = useCallback(async () => {
		await downloadAllFonts()
		await downloadAllIcons()
	}, [downloadAllFonts, downloadAllIcons])

	// The settings components take callbacks that return nothing, so downloads report their own errors.
	const onDownloadAll = useCallback(() => {
		downloadAll().catch(ErrorHandler.notice)
	}, [downloadAll])
	const onDownloadAllFonts = useCallback(() => {
		downloadAllFonts().catch(ErrorHandler.notice)
	}, [downloadAllFonts])
	const onDownloadAllIcons = useCallback(() => {
		downloadAllIcons().catch(ErrorHandler.notice)
	}, [downloadAllIcons])
	const onDownloadFont = useCallback(
		(font: FontTypes, config: DownloadInfo) => {
			downloadFont(font, config).catch(ErrorHandler.notice)
		},
		[downloadFont]
	)
	const onDownloadIcon = useCallback(
		(icon: IconNames, config: DownloadInfo) => {
			downloadIcon(icon, config).catch(ErrorHandler.notice)
		},
		[downloadIcon]
	)

	return (
		<>
			<Group heading="Download assets">
				<MemoAssetsSettingsGroup downloadAll={onDownloadAll} />
				<FontAssetsSettingsGroup downloadAll={onDownloadAllFonts} />
				<IconAssetsSettingsGroup downloadAll={onDownloadAllIcons} manager={assetManagers.icons} />
			</Group>
			<MemoFontAssetsSettingsGroup downloadFont={onDownloadFont} manager={assetManagers.fonts} />
			<Group heading="Icons">
				<MemoIconAssetsSettingsGroup downloadIcon={onDownloadIcon} manager={assetManagers.icons} />
			</Group>
		</>
	)
}
