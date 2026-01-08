import * as React from "react";
import { PDFDocument } from "pdf-lib";
import { useState } from "react";
import { Editor, useEditor } from "tldraw";
import { Pdf } from "./pdf.types";
import { App, Notice } from "obsidian";

interface ExportPdfButtonProps {
    pdf: Pdf;
    app: App;
}

export function ExportPdfButton({ pdf, app }: ExportPdfButtonProps) {
    const [exportProgress, setExportProgress] = useState<number | null>(null);
    const editor = useEditor();

    return (
        <button
            className="ExportPdfButton"
            onClick={async () => {
                setExportProgress(0);
                try {
                    await exportPdf(editor, pdf, app, setExportProgress);
                    new Notice("PDF exported successfully!");
                } catch (error) {
                    console.error("Failed to export PDF:", error);
                    new Notice("Failed to export PDF");
                } finally {
                    setExportProgress(null);
                }
            }}
        >
            {exportProgress !== null
                ? `Exporting... ${Math.round(exportProgress * 100)}%`
                : "Export PDF"}
        </button>
    );
}

async function exportPdf(
    editor: Editor,
    { name, source, pages }: Pdf,
    app: App,
    onProgress: (progress: number) => void
) {
    const totalThings = pages.length * 2 + 2;
    let progressCount = 0;
    const tickProgress = () => {
        progressCount++;
        onProgress(progressCount / totalThings);
    };

    const pdfDoc = await PDFDocument.load(source);
    tickProgress();

    const pdfPages = pdfDoc.getPages();
    if (pdfPages.length !== pages.length) {
        throw new Error("PDF page count mismatch");
    }

    const pageShapeIds = new Set(pages.map((page) => page.shapeId));
    const allIds = Array.from(editor.getCurrentPageShapeIds()).filter(
        (id) => !pageShapeIds.has(id)
    );

    for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const pdfPage = pdfPages[i];

        const bounds = page.bounds;
        const shapesInBounds = allIds.filter((id) => {
            const shapePageBounds = editor.getShapePageBounds(id);
            if (!shapePageBounds) return false;
            return shapePageBounds.collides(bounds);
        });

        if (shapesInBounds.length === 0) {
            tickProgress();
            tickProgress();
            continue;
        }

        const exportedPng = await editor.toImage(allIds, {
            format: "png",
            background: false,
            bounds: page.bounds,
            padding: 0,
            scale: 1,
        });
        tickProgress();

        const pngBytes = await exportedPng.blob.arrayBuffer();
        const pngImage = await pdfDoc.embedPng(pngBytes);
        pdfPage.drawImage(pngImage, {
            x: 0,
            y: 0,
            width: pdfPage.getWidth(),
            height: pdfPage.getHeight(),
        });
        tickProgress();
    }

    const pdfBytes = await pdfDoc.save();
    tickProgress();

    // Save to Obsidian vault
    const outputName = name.replace(/\.pdf$/i, "_annotated.pdf");
    const outputPath = outputName;

    await app.vault.createBinary(outputPath, pdfBytes);
    new Notice(`Saved as ${outputPath}`);
}
