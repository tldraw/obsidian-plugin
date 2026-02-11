import { pageIdValidator, TLPageId } from 'tldraw'

export default function toPageId(page: string | undefined) {
	return page === undefined || page.length === 0
		? undefined
		: !pageIdValidator.isValid(`page:${page}`)
			? undefined
			: (`page:${page}` as TLPageId)
}
