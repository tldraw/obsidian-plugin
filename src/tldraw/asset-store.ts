import { CachedMetadata, Notice, TFile } from "obsidian";
import TldrawPlugin from "src/main";
import { TldrawFileListener } from "src/obsidian/plugin/TldrawFileListenerMap";
import { createAttachmentFilepath } from "src/utils/utils";
import { DEFAULT_SUPPORTED_IMAGE_TYPES, TLAsset, TLAssetContext, TLAssetStore, TLImageAsset } from "tldraw";
import { TldrawStoreIndexedDB } from "./indexeddb-store";
import { vaultFileToBlob } from "src/obsidian/helpers/vault";
import { createImageAsset } from "./helpers/create-asset";
import * as PdfJS from "pdfjs-dist";

// @ts-ignore - imported as text via esbuild loader config
import pdfWorkerCode from "pdfjs-dist/build/pdf.worker.min.mjs";

// Create a blob URL from the real worker code (only once)
const workerBlob = new Blob([pdfWorkerCode], { type: 'application/javascript' });
PdfJS.GlobalWorkerOptions.workerSrc = URL.createObjectURL(workerBlob);

// PDF document cache
const pdfDocumentCache = new Map<string, Promise<PdfJS.PDFDocumentProxy>>();

// PDF rendered page cache (blob URLs)
const pdfRenderedCache = new Map<string, string>();

/**
 * Render a PDF page to a Blob URL
 */
async function renderPdfPageToBlob(
    plugin: TldrawPlugin,
    pdfPath: string,
    pageNumber: number,
    width: number,
    height: number,
    dpi: number = 150
): Promise<string> {
    const cacheKey = `${pdfPath}#${pageNumber}@${dpi}`;

    // Check cache
    if (pdfRenderedCache.has(cacheKey)) {
        return pdfRenderedCache.get(cacheKey)!;
    }

    // Load PDF document
    let pdfPromise = pdfDocumentCache.get(pdfPath);
    if (!pdfPromise) {
        pdfPromise = (async () => {
            const file = plugin.app.vault.getAbstractFileByPath(pdfPath);
            if (!file || !(file instanceof TFile)) {
                throw new Error(`PDF not found: ${pdfPath}`);
            }
            const arrayBuffer = await plugin.app.vault.readBinary(file);
            return PdfJS.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
        })();
        pdfDocumentCache.set(pdfPath, pdfPromise);
    }

    const pdf = await pdfPromise;
    const page = await pdf.getPage(pageNumber);

    // Calculate render scale using DPI (72 DPI = 1x scale in PDF)
    const baseViewport = page.getViewport({ scale: 1 });
    const fitScale = Math.min(width / baseViewport.width, height / baseViewport.height);
    // Convert DPI to scale factor (PDF default is 72 DPI)
    const dpiScale = dpi / 72;
    const renderScale = fitScale * dpiScale;
    const viewport = page.getViewport({ scale: renderScale });

    // Create offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Failed to get canvas context');

    // White background
    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Render
    await page.render({ canvasContext: context, viewport }).promise;

    // Convert to blob URL - use JPEG for smaller size and faster rendering
    const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/jpeg', 0.85);
    });
    const blobUrl = URL.createObjectURL(blob);

    // Cache it
    pdfRenderedCache.set(cacheKey, blobUrl);

    return blobUrl;
}


const blockRefAssetPrefix = 'obsidian.blockref.';
type BlockRefAssetId = `${typeof blockRefAssetPrefix}${string}`;

/**
 * Use a markdown file as an assets proxy for {@linkcode TLAssetStore}
 */
export class ObsidianMarkdownFileTLAssetStoreProxy {
    /**
     * <block reference id, asset base64 URI string>
     * 
     * We utilize a base64 data URI string here instead of a non-data URI because the TldrawImage component will display an image error without it.
    */
    readonly #resolvedAssetDataCache = new Map<BlockRefAssetId, string>();
    readonly #metadataListener: TldrawFileListener;

    #cachedMetadata: CachedMetadata | null;

    constructor(
        private readonly plugin: TldrawPlugin,
        /**
         * The markdown file 
         */
        private readonly tFile: TFile,
        private readonly onContentsChanged?: (fileContents: string, assetId: BlockRefAssetId, assetFile: TFile) => void
    ) {
        this.#cachedMetadata = this.plugin.app.metadataCache.getFileCache(tFile);
        this.#metadataListener = this.plugin.tldrawFileMetadataListeners.addListener(tFile, () => {
            this.#cachedMetadata = this.plugin.app.metadataCache.getFileCache(tFile);
        });
    }

    dispose() {
        this.#metadataListener.remove();
        // We want to avoid memory leaks: https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static#memory_management
        for (const objectURL of this.#resolvedAssetDataCache.values()) {
            URL.revokeObjectURL(objectURL);
        }
    }

    get cachedMetadata() {
        if (!this.#cachedMetadata) {
            throw new Error(`${ObsidianMarkdownFileTLAssetStoreProxy.name}: Cached metadata is unavailable for ${this.tFile.path}`);
        }
        return this.#cachedMetadata;
    }

    /**
     * Store an asset as a link in the markdown file
     * @param file The asset file to store a reference to in the markdown file.
     */
    async storeAsset(asset: TLAsset, file: File) {
        const blockRefId = window.crypto.randomUUID();
        const objectName = `${blockRefId}-${file.name}`.replace(/\W/g, '-')
        const ext = file.type.split('/').at(1);

        const {
            filename,
            folder
        } = await createAttachmentFilepath(
            this.plugin.app.fileManager,
            !ext ? objectName : `${objectName}.${ext}`, this.tFile,
        );

        const assetFile = await this.plugin.app.vault.createBinary(`${folder}/${filename}`,
            await file.arrayBuffer()
        );

        const assetSrc = await this.createLinkWithBlockRef(assetFile, blockRefId);

        this.cacheAsset(assetSrc, file)

        return assetSrc;
    }

    /**
     * Persist the asset file as a link within the markdown file and attach a block reference to it.
     * @param assetFile The file in the vault to link as an asset
     * @param blockRefId The reference id for the asset.
     * @returns 
     */
    async createLinkWithBlockRef(assetFile: TFile, blockRefId: string) {
        if (this.cachedMetadata.blocks?.[blockRefId] !== undefined) {
            throw new Error('Block ref already exists')
        }
        const internalLink = this.plugin.app.fileManager.generateMarkdownLink(assetFile, this.tFile.path);
        const linkBlock = `${internalLink}\n^${blockRefId}`;
        const assetSrc = `${blockRefAssetPrefix}${blockRefId}` as const;
        await this.plugin.app.vault.process(this.tFile, (data) => {
            const { start, end } = this.cachedMetadata.frontmatterPosition ?? {
                start: { offset: 0 }, end: { offset: 0 }
            };

            const frontmatter = data.slice(start.offset, end.offset)
            const rest = data.slice(end.offset);
            const contents = `${frontmatter}\n${linkBlock}\n${rest}`;
            this.onContentsChanged?.(contents, assetSrc, assetFile);
            return contents;
        });

        return assetSrc;
    }

    private cacheAsset(assetSrc: BlockRefAssetId, blob: Blob) {
        const assetDataUri = URL.createObjectURL(blob);
        this.#resolvedAssetDataCache.set(assetSrc, assetDataUri);
        return assetDataUri;
    }

    async getAsset(blockRefAssetId: BlockRefAssetId): Promise<Blob | null> {
        const blocks = this.cachedMetadata.blocks;
        if (!blocks) return null;

        const id = blockRefAssetId.slice(blockRefAssetPrefix.length)
        const assetBlock = blocks[id];
        if (!assetBlock) {
            new Notice(`Asset block not found: ${id}`);
            return null;
        }

        const assetBlockContents = (await this.plugin.app.vault.cachedRead(this.tFile))
            .substring(assetBlock.position.start.offset, assetBlock.position.end.offset);
        const insideBrackets = /\[\[(.*?)\]\]/;
        const link = assetBlockContents.match(insideBrackets)?.at(1);

        if (!link) {
            new Notice(`Asset block does not reference a link: ${id}`);
            return null;
        }

        const assetFile = this.plugin.app.metadataCache.getFirstLinkpathDest(link, this.tFile.path);

        if (!assetFile) {
            new Notice(`Asset block link did not reference a known file: ${id} (${link})`);
            return null;
        }

        return vaultFileToBlob(assetFile);
    }

    /**
     * Get the asset from the cache, or read it and cache it if the asset exists
     * @param blockRefAssetId 
     */
    async getCached(blockRefAssetId: BlockRefAssetId) {
        const cachedAsset = this.#resolvedAssetDataCache.get(blockRefAssetId);
        if (cachedAsset) return cachedAsset;
        const assetData = await this.getAsset(blockRefAssetId);
        if (!assetData) return null;
        return this.cacheAsset(
            blockRefAssetId,
            assetData,
        );
    }

    async getAll(): Promise<BlockRefAssetId[]> {
        return Object.values(this.cachedMetadata.blocks ?? {}).map(
            (e) => `${blockRefAssetPrefix}${e.id}` as const
        );
    }

    async createImageAsset(assetFile: TFile, {
        blockRefId = window.crypto.randomUUID(),
        immediatelyCache = false,
    }: {
        blockRefId?: string,
        /**
         * Setting to `true` will essentially make the asset data available without having to refer to the link referenced by a block ref.
         * Skips having to read the file metadata to locate the asset with via the block ref.
         * 
         * @default false
         */
        immediatelyCache?: boolean,
    } = {}): Promise<TLImageAsset> {
        const assetBlob = await vaultFileToBlob(assetFile);

        if (!(DEFAULT_SUPPORTED_IMAGE_TYPES as readonly string[]).includes(assetBlob.type)) {
            throw new Error(`Expected an image mime-type, got ${assetBlob.type}`, {
                cause: {
                    message: 'The provided file is not an image type.',
                    assetFile,
                    type: assetBlob.type,
                }
            });
        }

        const assetSrc = await this.createLinkWithBlockRef(assetFile, blockRefId);

        /**
         * Should be revoked if not added to the cache.
         */
        const assetUri = immediatelyCache
            ? this.cacheAsset(assetSrc, assetBlob)
            : URL.createObjectURL(assetBlob);

        try {
            const { width, height } = await (async () => {
                const image = new Image();
                image.src = assetUri;
                await image.decode()
                return image;
            })();

            return createImageAsset({
                props: {
                    isAnimated: false,
                    fileSize: assetBlob.size,
                    mimeType: assetBlob.type,
                    name: assetFile.name,
                    src: `asset:${assetSrc}`,
                    w: width,
                    h: height,
                },
            });
        } finally {
            if (!immediatelyCache) {
                // We only needed the object url for getting the width and height.
                URL.revokeObjectURL(assetUri);
            }
        }
    }
}

/**
 * Prohibits modifications to the markdown file.
 */
export class ObsidianReadOnlyMarkdownFileTLAssetStoreProxy extends ObsidianMarkdownFileTLAssetStoreProxy {
    storeAsset(asset: TLAsset, file: File): Promise<never> {
        throw new Error(`${ObsidianReadOnlyMarkdownFileTLAssetStoreProxy.name}: Storing assets is prohibited in read-only mode.`)
    }
}

/**
 * Replaces the default tldraw asset store with one that saves assets to the attachment folder.
 * 
 * See more:
 * 
 * https://tldraw.dev/examples/data/assets/hosted-images
 */
export class ObsidianTLAssetStore implements TLAssetStore {
    private db?: null | TldrawStoreIndexedDB;
    private readonly resolvedIDBCache = new Map<string, string>();

    constructor(
        /**
         * The persistence key which references a {@linkcode TLAssetStore} in the {@linkcode IDBDatabase}
         */
        public readonly persistenceKey: string,
        public readonly proxy: ObsidianMarkdownFileTLAssetStoreProxy,
    ) {
        this.upload = this.upload.bind(this);
        this.resolve = this.resolve.bind(this);
    }

    dispose() {
        this.proxy.dispose();
        // We want to avoid memory leaks: https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static#memory_management
        for (const objectURL of this.resolvedIDBCache.values()) {
            URL.revokeObjectURL(objectURL);
        }
    }

    async upload(asset: TLAsset, file: File, _: AbortSignal): ReturnType<TLAssetStore['upload']> {
        const blockRefAssetId = await this.proxy.storeAsset(asset, file);
        return {
            src: `asset:${blockRefAssetId}`,
        };
    }

    async resolve(asset: TLAsset, ctx: TLAssetContext): Promise<null | string> {
        const assetSrc = asset.props.src;
        if (!assetSrc) return null;

        // Handle PDF asset: asset:pdf.[[wikilink]]#pageNumber or asset:pdf.path#pageNumber
        if (assetSrc.startsWith('asset:pdf.')) {
            try {
                const rest = assetSrc.slice(10); // Remove "asset:pdf."
                const hashIndex = rest.lastIndexOf('#');
                let pdfRef = hashIndex >= 0 ? rest.slice(0, hashIndex) : rest;
                const pageNumber = hashIndex >= 0 ? parseInt(rest.slice(hashIndex + 1)) || 1 : 1;

                // Check if it's a WikiLink format [[name]]
                let pdfPath: string;
                const wikiLinkMatch = pdfRef.match(/^\[\[(.+?)\]\]$/);
                if (wikiLinkMatch) {
                    // Resolve WikiLink using Obsidian's metadataCache
                    const linkName = wikiLinkMatch[1];
                    const plugin = this.proxy['plugin'];
                    // Use the Tldraw file's path as source for relative resolution
                    const sourcePath = this.proxy['tFile']?.path || '';
                    const resolvedFile = plugin.app.metadataCache.getFirstLinkpathDest(linkName, sourcePath);
                    if (!resolvedFile) {
                        console.error('[PDF Resolve] WikiLink not found:', linkName);
                        return null;
                    }
                    pdfPath = resolvedFile.path;
                } else {
                    // Direct path format
                    pdfPath = pdfRef;
                }

                // Get dimensions and DPI from asset
                const w = (asset.props as any).w || 595;
                const h = (asset.props as any).h || 842;
                const dpi = (asset.meta as any)?.dpi || 150;

                return await renderPdfPageToBlob(this.proxy['plugin'], pdfPath, pageNumber, w, h, dpi);
            } catch (err) {
                console.error('[PDF Resolve] Error:', err);
                return null;
            }
        }

        if (!assetSrc.startsWith('asset:')) return assetSrc;

        const assetId = assetSrc.split(':').at(1);

        if (!assetId) return null;

        if (!assetId.startsWith(blockRefAssetPrefix)) {
            return this.getFromIndexedDB(assetSrc as `asset:${string}`);
        }

        return this.proxy.getCached(assetId as BlockRefAssetId)
    }

    async getFromMarkdown(assetSrc: BlockRefAssetId) {
        return this.proxy.getCached(assetSrc);
    }

    async tryOpenDb() {
        if (this.db === null) {
            // Already tried
            return null;
        }
        return this.db = await TldrawStoreIndexedDB.open(this.persistenceKey);
    }

    async getFromIndexedDB(assetSrc: `asset:${string}`): Promise<string | null> {
        const cachedAssetUri = this.resolvedIDBCache.get(assetSrc);
        if (cachedAssetUri) return cachedAssetUri;
        const db = await this.tryOpenDb();
        if (!db) return null;
        const blob = await db.getAsset(assetSrc)
        if (!blob) return null;
        const assetUri = URL.createObjectURL(blob);
        this.resolvedIDBCache.set(assetSrc, assetUri);
        return assetUri;
    }

    async getAllFromIndexedDB(): Promise<`asset:${string}`[]> {
        const db = await this.tryOpenDb();
        if (!db) return [];
        await db.openDb();
        return db.getAllAssetSources();
    }

    async getAllFromMarkdownFile(): Promise<BlockRefAssetId[]> {
        return this.proxy.getAll();
    }
}
