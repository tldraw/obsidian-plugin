import { AssetRecordType, FileHelpers, TLAssetId, TLImageAsset } from 'tldraw'

interface CreateImageAssetProps {
	id?: TLAssetId
	meta?: TLImageAsset['meta']
	props: TLImageAsset['props']
}

export function createImageAsset({
	id = AssetRecordType.createId(),
	props,
	meta = {},
}: CreateImageAssetProps): TLImageAsset {
	return {
		id,
		type: 'image',
		typeName: 'asset',
		props,
		meta,
	}
}

export async function createDataUrlImageAssetFromBlob(
	blob: Blob,
	{
		name,
	}: {
		name: string
	}
) {
	const src = await FileHelpers.blobToDataUrl(blob)

	const { width, height } = await (async () => {
		const image = new Image()
		image.src = src
		await image.decode()
		return image
	})()

	return createImageAsset({
		props: {
			isAnimated: false,
			fileSize: blob.size,
			mimeType: blob.type,
			name,
			src,
			w: width,
			h: height,
		},
	})
}
