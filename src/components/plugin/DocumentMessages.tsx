import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { useTldrawInObsdianPlugin } from 'src/contexts/plugin'
import { DocumentMessagesButton } from 'src/obsidian/plugin/instance'
import { DocumentMessagesModal } from './DocumentMessagesModal'

export default function DocumentMessages() {
	const instance = useTldrawInObsdianPlugin()

	const dmbStore = useMemo(() => {
		return instance.stores.documentMessages
	}, [instance])

	const dmbss = useSyncExternalStore(dmbStore.addListener, dmbStore.getAll)

	return (
		<>
			{dmbss.map((e, i) => (
				<DocumentMessagesButtonPortal key={e.key} button={e} />
			))}
		</>
	)
}

function DocumentMessagesButtonPortal({ button }: { button: DocumentMessagesButton }) {
	const [count, setCount] = useState(() => button.messages.getCount())
	const [isModalOpen, setIsModalOpen] = useState(false)

	const cb = useCallback((evt: MouseEvent) => {
		setIsModalOpen(true)
	}, [])

	useEffect(() => {
		button.onClicked = cb
		return () => (button.onClicked = undefined)
	}, [button, cb])

	useEffect(() => {
		return button.messages.addListener(() => {
			setCount(button.messages.getCount())
		})
	}, [button])

	return (
		<>
			{createPortal(
				<div className="ptl-document-messages-count">{count || undefined}</div>,
				button.actionEl
			)}
			<DocumentMessagesModal
				messages={button.messages}
				open={isModalOpen}
				onClose={() => setIsModalOpen(false)}
			/>
		</>
	)
}
