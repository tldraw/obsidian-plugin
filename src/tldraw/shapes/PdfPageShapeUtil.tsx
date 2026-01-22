import * as React from "react";
import {
    BaseBoxShapeUtil,
    HTMLContainer,
    RecordProps,
    T,
    TLBaseShape,
    TLOnResizeHandler,
    resizeBox,
} from "tldraw";
import * as PdfJS from "pdfjs-dist";
// Removed import: import { PdfPageRenderer } from "src/components/pdf/PdfPageRenderer";

// Lazy load the renderer to break circular dependency
const PdfPageRenderer = React.lazy(async () => {
    const { PdfPageRenderer } = await import("src/components/pdf/PdfPageRenderer");
    return { default: PdfPageRenderer };
});

// Import the real PDF.js worker code as a string (via esbuild text loader)
// @ts-ignore - imported as text via esbuild loader config
import pdfWorkerCode from "pdfjs-dist/build/pdf.worker.min.mjs";

// Create a blob URL from the real worker code (only once)
const workerBlob = new Blob([pdfWorkerCode], { type: 'application/javascript' });
PdfJS.GlobalWorkerOptions.workerSrc = URL.createObjectURL(workerBlob);

// Define the shape type
export type PdfPageShape = TLBaseShape<
    'pdf-page',
    {
        pdfPath: string;      // Path to PDF in Obsidian vault
        pageNumber: number;   // 1-indexed page number
        w: number;
        h: number;
    }
>;

// PDF Page Shape Util
export class PdfPageShapeUtil extends BaseBoxShapeUtil<PdfPageShape> {
    static override type = 'pdf-page' as const;

    static override props: RecordProps<PdfPageShape> = {
        pdfPath: T.string,
        pageNumber: T.number,
        w: T.number,
        h: T.number,
    };

    override getDefaultProps(): PdfPageShape['props'] {
        return {
            pdfPath: '',
            pageNumber: 1,
            w: 595, // A4 width at 72 DPI
            h: 842, // A4 height at 72 DPI
        };
    }

    override component(shape: PdfPageShape) {
        return (
            <HTMLContainer
                id={shape.id}
                style={{
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'all',
                }}
            >
                <React.Suspense fallback={<div style={{ width: '100%', height: '100%', background: '#eee' }} />}>
                    <PdfPageRenderer
                        pdfPath={shape.props.pdfPath}
                        pageNumber={shape.props.pageNumber}
                        width={shape.props.w}
                        height={shape.props.h}
                    />
                </React.Suspense>
            </HTMLContainer>
        );
    }

    override indicator(shape: PdfPageShape) {
        return <rect width={shape.props.w} height={shape.props.h} />;
    }

    override onResize: TLOnResizeHandler<PdfPageShape> = (shape, info) => {
        return resizeBox(shape, info);
    };
}
