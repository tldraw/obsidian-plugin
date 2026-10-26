import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ModalWrapper } from 'src/obsidian/react/modal'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const roots: ReturnType<typeof createRoot>[] = []
const modalProps = { app: {} as never }

function renderWrapper(open: boolean, onClose: () => void) {
	return createElement(ModalWrapper, { modalProps, open, onClose, children: 'content' })
}

afterEach(async () => {
	await act(async () => roots.splice(0).forEach((r) => r.unmount()))
})

describe('ModalWrapper', () => {
	it('calls the latest onClose when the modal closes after a re-render', async () => {
		const root = createRoot(document.createElement('div'))
		roots.push(root)
		const first = vi.fn()
		const second = vi.fn()

		await act(async () => root.render(renderWrapper(true, first)))
		await act(async () => root.render(renderWrapper(true, second)))
		await act(async () => root.render(renderWrapper(false, second)))

		expect(second).toHaveBeenCalledTimes(1)
		expect(first).not.toHaveBeenCalled()
	})
})
