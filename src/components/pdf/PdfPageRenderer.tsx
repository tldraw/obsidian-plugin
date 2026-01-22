import * as React from "react";
import { useEditor } from "tldraw";
import { useObsidian } from "src/contexts/plugin";
import * as PdfJS from "pdfjs-dist";

// Debounce utility
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = React.useState(value);

    React.useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => clearTimeout(handler);
    }, [value, delay]);

    return debouncedValue;
}

// Cache for loaded PDFs
const pdfCache = new Map<string, Promise<PdfJS.PDFDocumentProxy>>();

// Load PDF logic (moved here or shared)
async function loadPdfDocument(app: any, pdfPath: string): Promise<PdfJS.PDFDocumentProxy> {
    if (!pdfCache.has(pdfPath)) {
        const loadPromise = (async () => {
            if (!app) throw new Error("Obsidian app not available");
            const file = app.vault.getAbstractFileByPath(pdfPath);
            if (!file) throw new Error(`PDF not found: ${pdfPath}`);
            const arrayBuffer = await app.vault.readBinary(file);
            return await PdfJS.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
        })();
        pdfCache.set(pdfPath, loadPromise);
    }
    return pdfCache.get(pdfPath)!;
}

export function PdfPageRenderer({
    pdfPath,
    pageNumber,
    width,
    height,
}: {
    pdfPath: string;
    pageNumber: number;
    width: number;
    height: number;
}) {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [loading, setLoading] = React.useState(true);
    const renderIdRef = React.useRef(0);

    const editor = useEditor();
    const app = useObsidian();
    const zoomLevel = editor.getZoomLevel();
    // Debounce zoom changes to avoid too many re-renders
    const debouncedZoom = useDebounce(zoomLevel, 100);

    const renderScale = React.useMemo(() => {
        const dpr = window.devicePixelRatio || 1;
        // Improve base quality: at least 3.0 for sharper text
        const baseQuality = Math.max(dpr, 3.0);

        // Scale with zoom, but cap at 5x relative to base
        const zoomFactor = Math.min(Math.max(debouncedZoom, 1), 5);

        return baseQuality * zoomFactor;
    }, [debouncedZoom]);

    React.useEffect(() => {
        renderIdRef.current += 1;
        const currentRenderId = renderIdRef.current;

        async function renderPage() {
            if (!canvasRef.current || !pdfPath) return;

            try {
                // Determine if we need to show loading (only if switching pages/files, not just zoom)
                // Actually, for zoom updates, we prefer keeping the old canvas visible until new one is ready
                // but we explicitly want to "sharpen". For now, keeping simple loading state is safer for bugs.
                // Optim: Don't set loading=true if we are just re-scaling? 
                // Let's keep it simple: set loading.

                // setLoading(true); // Maybe don't flash loading on zoom?
                // Visual polish: only set loading if completely new pdfPath/pageNumber

                // Ensure we have the doc
                const pdf = await loadPdfDocument(app, pdfPath);
                if (currentRenderId !== renderIdRef.current) return;

                const page = await pdf.getPage(pageNumber);
                if (currentRenderId !== renderIdRef.current) return;

                const canvas = canvasRef.current;
                if (!canvas) return; // Guard against unmount
                const context = canvas.getContext('2d', { alpha: false });
                if (!context) return;

                const baseViewport = page.getViewport({ scale: 1 });

                // Calculate scale to fill the shape dimensions
                // We use 'width' / 'height' from props which match the Shape's dimensions in Tldraw
                const fitScaleX = width / baseViewport.width;
                const fitScaleY = height / baseViewport.height;
                const fitScale = Math.min(fitScaleX, fitScaleY);

                const finalScale = fitScale * renderScale;
                const scaledViewport = page.getViewport({ scale: finalScale });

                // Update canvas internal dimensions (high res)
                canvas.width = scaledViewport.width;
                canvas.height = scaledViewport.height;

                // Update canvas display dimensions (match shape)
                canvas.style.width = '100%';
                canvas.style.height = '100%';

                context.clearRect(0, 0, canvas.width, canvas.height);
                await page.render({
                    canvasContext: context,
                    viewport: scaledViewport,
                }).promise;

                if (currentRenderId === renderIdRef.current) {
                    setLoading(false);
                    setError(null);
                }
            } catch (err) {
                if (currentRenderId === renderIdRef.current) {
                    console.error("PDF Render Error:", err);
                    setError((err as Error).message);
                    setLoading(false);
                }
            }
        }

        renderPage();
    }, [pdfPath, pageNumber, width, height, renderScale, app]);

    if (error) {
        return (
            <div style={{ width: '100%', height: '100%', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d44', fontSize: '0.8em', padding: 4 }}>
                Failed to load PDF
            </div>
        );
    }

    return (
        <div style={{ width: '100%', height: '100%', overflow: 'hidden', background: 'white' }}>
            <canvas
                ref={canvasRef}
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'block',
                    opacity: loading ? 0.5 : 1, // Fade instead of hide
                    transition: 'opacity 0.2s ease',
                }}
            />
        </div>
    );
}
