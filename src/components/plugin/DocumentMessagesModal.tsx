import { TFile } from 'obsidian'
import React from 'react'
import { useTldrawPlugin } from 'src/contexts/plugin'
import { useStorify } from 'src/hooks/useStorify'
import { navigateToBlockCache } from 'src/obsidian/file/navigate'
import { DocumentMessage } from 'src/obsidian/plugin/TLDataDocumentMessages'
import { MainDataMessages } from 'src/obsidian/plugin/TLDataDocumentStoreManager'
import { ButtonComponent, Modal } from 'src/obsidian/react-components'

export function DocumentMessagesModal({
	messages,
	open,
	onClose,
}: {
	messages: MainDataMessages
	open: boolean
	onClose: () => void
}) {
	const plugin = useTldrawPlugin()
	const allMessages = useStorify(messages.addListener, messages.getAll)

	return (
		<Modal modalProps={plugin} open={open} onClose={onClose}>
			<div className="ptl-document-messages-modal">
				{allMessages.length === 0 ? (
					<p>No messages.</p>
				) : (
					<>
						<header>{`Document Messages (${allMessages.length})`}</header>
						<div className="ptl-document-messages-list">
							{allMessages.map((message, index) => (
								<DocumentMessageItem
									key={getMessageKey(message, index)}
									message={message}
									messages={messages}
								/>
							))}
						</div>
						{allMessages.length > 1 && (
							<div className="ptl-document-messages-actions">
								<button
									className="mod-cta"
									onClick={() => {
										messages.dismissAll()
										onClose()
									}}
								>
									Dismiss All
								</button>
							</div>
						)}
					</>
				)}
			</div>
		</Modal>
	)
}

function getMessageKey(message: DocumentMessage, index: number): string {
	switch (message.type) {
		case 'blockRefError':
			return message.state.blockId ?? `message-${index}`
		default:
			return `message-${index}`
	}
}

function DocumentMessageItem({
	message,
	messages,
}: {
	message: DocumentMessage
	messages: MainDataMessages
}) {
	switch (message.type) {
		case 'blockRefError':
			return <BlockRefErrorMessageItem message={message} messages={messages} />
		default:
			return (
				<div className="ptl-document-message-item">
					<p className="ptl-document-message-text">{`Unknown message type: ${message.type}`}</p>
					<ButtonComponent text="Dismiss" onClick={() => message.dismiss()} />
				</div>
			)
	}
}

function BlockRefErrorMessageItem({
	message,
	messages,
}: {
	message: Extract<DocumentMessage, { type: 'blockRefError' }>
	messages: MainDataMessages
}) {
	const { state } = message
	const tFile = messages.getFile()
	const errors = [
		state.asset && {
			type: 'asset' as const,
			asset: state.asset,
		},
	].filter((e) => e !== undefined)

	return (
		<div className="ptl-document-message-item" data-with-error={message.type}>
			{state.blockId && <div className="ptl-message-detail">Block ID: {state.blockId}</div>}
			{errors.length === 0 ? (
				<>Hmm... 🤔 we overlooked something.</>
			) : (
				errors.map((e, index) => {
					const content = (() => {
						switch (e.type) {
							case 'asset':
								return (
									<div className="ptl-document-message-details" data-message-type={e.asset.message}>
										<BlockRefErrorTypeMessage
											asset={e.asset}
											tFile={tFile}
											blockId={state.blockId}
										/>
									</div>
								)
							default:
								return <>Hmm... 🤔 we overlooked the error type: {e.type}.</>
						}
					})()
					return (
						<div className="ptl-document-message-item-error" data-error-type={e.type} key={index}>
							{content}
						</div>
					)
				})
			)}
			<ButtonComponent text="Dismiss" onClick={() => message.dismiss()} />
		</div>
	)
}

function BlockRefErrorTypeMessage({
	asset,
	tFile,
	blockId,
}: {
	asset: NonNullable<Extract<DocumentMessage, { type: 'blockRefError' }>['state']['asset']>
	tFile: TFile
	blockId: string
}) {
	const plugin = useTldrawPlugin()

	const navigateToBlock = async () => {
		if (!asset.item) return

		navigateToBlockCache(plugin, tFile, asset.item)
	}

	let typeSpecificMessage = ''
	switch (asset.message) {
		case 'notFound':
			typeSpecificMessage = `Asset block reference was not found.`
			break
		case 'notALink':
			typeSpecificMessage = `Block does not reference a link.`
			break
		case 'unknownFile':
			typeSpecificMessage = `Block links to unknown file: "${asset.link}".`
			break
		case 'errorLoading':
			typeSpecificMessage = `Error loading asset from "${asset.link}" in block.`
			break
	}

	return (
		<div className="ptl-message-type-specific">
			{typeSpecificMessage}
			{asset.item && <ButtonComponent text="Go to Block" onClick={navigateToBlock} />}
		</div>
	)
}
