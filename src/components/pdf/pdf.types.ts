import { Box, TLAssetId, TLShapeId } from "tldraw";

/**
 * Represents a single page of a PDF document
 */
export interface PdfPage {
    /** Base64 data URL of the rendered page image */
    src: string;
    /** Bounds of the page in the tldraw canvas */
    bounds: Box;
    /** Asset ID for the page image */
    assetId: TLAssetId;
    /** Shape ID for the page image shape */
    shapeId: TLShapeId;
}

/**
 * Represents a loaded PDF document
 */
export interface Pdf {
    /** Name of the PDF file */
    name: string;
    /** Array of rendered pages */
    pages: PdfPage[];
    /** Original PDF source data */
    source: ArrayBuffer;
}

/**
 * Options for loading a PDF
 */
export interface PdfLoadOptions {
    /** Visual scale for rendering (default: 1.5) */
    visualScale?: number;
    /** Spacing between pages in pixels (default: 32) */
    pageSpacing?: number;
}
