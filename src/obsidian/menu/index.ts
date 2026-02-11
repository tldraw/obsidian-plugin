import { MenuItem } from 'obsidian'
import { TLDRAW_ICON_NAME } from 'src/utils/constants'

export function pluginMenuLabel(
	menuItem: MenuItem,
	{
		title = 'Tldraw in Obsidian',
	}: {
		title?: string
	} = {}
) {
	return menuItem.setIcon(TLDRAW_ICON_NAME).setIsLabel(true).setTitle(title)
}
