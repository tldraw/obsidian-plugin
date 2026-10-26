import { App, Modal } from 'obsidian'
import React, { ReactNode, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
	app: App
}

/**
 * A wrapper for the Obsidian {@linkcode Modal} component that allows for React rendering inside the modal.
 *
 */
export function ModalWrapper({
	open,
	className,
	modalProps,
	children,
	onClose,
}: {
	modalProps: ModalProps
	open: boolean
	className?: string
	children: ReactNode
	onClose: () => void
}) {
	// The modal is only recreated when `modalProps` changes, so it calls the latest `onClose` through a ref.
	const onCloseRef = useRef(onClose)
	useLayoutEffect(() => {
		onCloseRef.current = onClose
	}, [onClose])

	const modal = useMemo(() => {
		return new Modal(modalProps.app).setCloseCallback(() => onCloseRef.current())
	}, [modalProps])

	useEffect(() => {
		return () => {
			// Modal or modalProps changed, close the old one
			modal.close()
		}
	}, [modal, modalProps])

	useEffect(() => {
		if (open) {
			modal.open()
		} else {
			modal.close()
		}
	}, [modal, open])

	useEffect(() => {
		if (className) {
			modal.modalEl.addClass(className)
		}
	}, [modal, className])

	if (!open) {
		return null
	}

	return <>{createPortal(children, modal.contentEl)}</>
}
