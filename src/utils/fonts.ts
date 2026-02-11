import { TFile, TFolder } from 'obsidian'

type FontAsset = [type: 'license' | 'font', file: TFile]

function fontAssetMatcher(file: TFile): undefined | FontAsset {
	const licenseMatch = /license/i
	if (licenseMatch.test(file.name)) {
		return ['license', file]
	}

	if (!['otf', 'ttf', 'woff', 'woff2'].includes(file.extension)) return

	return ['font', file]
}

function fontAssetMapper(files: TFile[]) {
	return files
		.filter((e) => e instanceof TFile)
		.map((e) => fontAssetMatcher(e))
		.filter((e) => e !== undefined)
}

export function getFontAssets(tFolder: TFolder) {
	// Expect the fonts to be in their own subdirectories for organization purposes.
	const fontAssets = fontAssetMapper(tFolder.children.filter((e) => e instanceof TFile))

	const dirs = tFolder.children.filter((e) => e instanceof TFolder)
	const subDirsFonts: [dir: TFolder, assets: FontAsset[]][] = []

	for (const dir of dirs) {
		const subDirFontAssets = fontAssetMapper(dir.children.filter((e) => e instanceof TFile))
		if (subDirFontAssets.length === 0) continue
		subDirsFonts.push([dir, subDirFontAssets])
	}

	return {
		fontAssets,
		searchDir: tFolder,
		subDirs: subDirsFonts,
		getAll() {
			return [
				...this.fontAssets,
				...this.subDirs.reduce<FontAsset[]>((prev, e) => {
					prev.push(...e[1])
					return prev
				}, []),
			]
		},
		getAllAssetType(type: FontAsset[0]) {
			return this.getAll()
				.filter((e) => e[0] === type)
				.map((e) => e[1])
		},
	}
}
