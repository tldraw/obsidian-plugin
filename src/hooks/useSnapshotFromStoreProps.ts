import * as React from 'react'
import { Store, TldrawEditorStoreProps } from 'tldraw'

/**
 * If {@linkcode storeProps} changes, then get the new snapshot.
 * @param storeProps
 * @returns The new snapshot.
 */
export default function useSnapshotFromStoreProps(storeProps?: TldrawEditorStoreProps) {
	const [snapshot, setSnapshot] = React.useState<ReturnType<typeof getSnapshot>>()

	const getSnapshot = React.useCallback(
		() =>
			!storeProps
				? undefined
				: !storeProps.store
					? storeProps.snapshot
					: storeProps.store instanceof Store
						? storeProps.store.getStoreSnapshot()
						: storeProps.store.store?.getStoreSnapshot(),
		[storeProps]
	)

	React.useEffect(() => {
		setSnapshot(getSnapshot())
	}, [getSnapshot, setSnapshot])

	return snapshot
}
