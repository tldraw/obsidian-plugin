import * as PdfJS from "pdfjs-dist";
import { AssetRecordType, Box, createShapeId } from "tldraw";

// Import the real PDF.js worker code as a string (via esbuild text loader)
// @ts-ignore - imported as text via esbuild loader config
import pdfWorkerCode from "pdfjs-dist/build/pdf.worker.min.mjs";

// Create a blob URL from the real worker code
const workerBlob = new Blob([pdfWorkerCode], { type: 'application/javascript' });
PdfJS.GlobalWorkerOptions.workerSrc = URL.createObjectURL(workerBlob);

export interface PdfPageInfo {
    pageNumber: number;
    width: number;
    height: number;
    src?: string; // Optional thumbnail data URL
}

/**
 * Load PDF page dimensions only.
 */
export async function loadPdfMetadata(
    app: any, // Obsidian App
    pdfPath: string
): Promise<PdfPageInfo[]> {
    console.log("[loadPdfMetadata] Loading PDF:", pdfPath);

    const file = app.vault.getAbstractFileByPath(pdfPath);
    if (!file) {
        throw new Error(`PDF not found: ${pdfPath}`);
    }

    const arrayBuffer = await app.vault.readBinary(file);

    const loadingTask = PdfJS.getDocument({
        data: new Uint8Array(arrayBuffer),
    });

    const pdf = await loadingTask.promise;
    console.log("[loadPdfMetadata] PDF loaded, pages:", pdf.numPages);

    const pages: PdfPageInfo[] = [];

    // Scale 1.0 for dimensions (72 DPI)
    // tldraw uses 1 unit = 1 pixel at 100% zoom
    const DIMENSION_SCALE = 1.0;

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: DIMENSION_SCALE });

        pages.push({
            pageNumber: i,
            width: viewport.width,
            height: viewport.height,
        });
    }

    return pages;
}

