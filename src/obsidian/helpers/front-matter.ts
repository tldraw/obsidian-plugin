import { MetadataCache, TFile } from 'obsidian'

export function getFrontMatterList(metadataCache: MetadataCache, tFile: TFile, key: string) {
	const frontMatter = metadataCache.getFileCache(tFile)?.frontmatter
	if (!frontMatter) return undefined
	return !Array.isArray(frontMatter[key]) ? undefined : frontMatter[key]
}

const tagRegex = /^[a-zA-Z0-9_\-/]+$/
const atLeastOneAlpha = /[a-zA-Z]/

export function isValidFrontmatterTag(tag: string) {
	return tagRegex.test(tag) && atLeastOneAlpha.test(tag)
}
