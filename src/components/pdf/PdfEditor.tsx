import * as React from "react";
import { useMemo } from "react";
import {
    Box,
    SVGContainer,
    TLComponents,
    TLImageShape,
    TLShapePartial,
    Tldraw,
    getIndicesBetween,
    react,
    sortByIndex,
    track,
    useEditor,
    Editor,
    TLShape,
    TLShapeId,
} from "tldraw";
import { ExportPdfButton } from "./ExportPdfButton";
import { Pdf } from "./pdf.types";
import { App } from "obsidian";
import { isObsidianThemeDark } from "src/utils/utils";

interface PdfEditorProps {
    pdf: Pdf;
    app: App;
    isDarkMode?: boolean;
}

/**
 * PDF Editor component that renders PDF pages as locked image shapes
 * and allows annotations on top of them
 */
export function PdfEditor({ pdf, app, isDarkMode }: PdfEditorProps) {
    const darkMode = isDarkMode ?? isObsidianThemeDark();

    const components = useMemo<TLComponents>(
        () => ({
            PageMenu: null,
            Overlays: () => <PageOverlayScreen pdf={pdf} isDarkMode={darkMode} />,
            SharePanel: () => <ExportPdfButton pdf={pdf} app={app} />,
        }),
        [pdf, app, darkMode]
    );

    return (
        <Tldraw
            forceMobile={false}
            onMount={(editor) => {
                // Create assets for each PDF page
                editor.createAssets(
                    pdf.pages.map((page) => ({
                        id: page.assetId,
                        typeName: "asset",
                        type: "image",
                        meta: {},
                        props: {
                            w: page.bounds.w,
                            h: page.bounds.h,
                            mimeType: "image/png",
                            src: page.src,
                            name: "page",
                            isAnimated: false,
                        },
                    }))
                );

                // Create image shapes for each page (locked)
                editor.createShapes(
                    pdf.pages.map(
                        (page): TLShapePartial<TLImageShape> => ({
                            id: page.shapeId,
                            type: "image",
                            x: page.bounds.x,
                            y: page.bounds.y,
                            isLocked: true,
                            props: {
                                assetId: page.assetId,
                                w: page.bounds.w,
                                h: page.bounds.h,
                            },
                        })
                    )
                );

                const shapeIds = pdf.pages.map((page) => page.shapeId);
                const shapeIdSet = new Set(shapeIds);

                // Prevent unlocking PDF page shapes
                editor.sideEffects.registerBeforeChangeHandler("shape", (prev, next) => {
                    if (!shapeIdSet.has(next.id)) return next;
                    if (next.isLocked) return next;
                    return { ...prev, isLocked: true };
                });

                // Keep PDF pages at the bottom of the z-order
                function makeSureShapesAreAtBottom() {
                    const shapes = shapeIds
                        .map((id) => editor.getShape(id)!)
                        .filter(Boolean)
                        .sort(sortByIndex);
                    if (shapes.length === 0) return;

                    const pageId = editor.getCurrentPageId();
                    const siblings = editor.getSortedChildIdsForParent(pageId);
                    const currentBottomShapes = siblings
                        .slice(0, shapes.length)
                        .map((id) => editor.getShape(id)!);

                    if (currentBottomShapes.every((shape, i) => shape.id === shapes[i].id)) return;

                    const otherSiblings = siblings.filter((id) => !shapeIdSet.has(id));
                    if (otherSiblings.length === 0) return;

                    const bottomSibling = otherSiblings[0];
                    const bottomShape = editor.getShape(bottomSibling);
                    if (!bottomShape) return;

                    const lowestIndex = bottomShape.index;
                    const indexes = getIndicesBetween(undefined, lowestIndex, shapes.length);

                    editor.updateShapes(
                        shapes.map((shape, i) => ({
                            ...shape,
                            id: shape.id,
                            isLocked: shape.isLocked,
                            index: indexes[i],
                        }))
                    );
                }

                makeSureShapesAreAtBottom();
                editor.sideEffects.registerAfterCreateHandler("shape", makeSureShapesAreAtBottom);
                editor.sideEffects.registerAfterChangeHandler("shape", makeSureShapesAreAtBottom);

                // Configure camera constraints for PDF navigation
                const targetBounds = pdf.pages.reduce(
                    (acc, page) => acc.union(page.bounds),
                    pdf.pages[0].bounds.clone()
                );

                function updateCameraBounds(isMobile: boolean) {
                    editor.setCameraOptions({
                        constraints: {
                            bounds: targetBounds,
                            padding: { x: isMobile ? 16 : 164, y: 64 },
                            origin: { x: 0.5, y: 0 },
                            initialZoom: "fit-x-100",
                            baseZoom: "default",
                            behavior: "contain",
                        },
                    });
                    editor.setCamera(editor.getCamera(), { reset: true });
                }

                let isMobile = editor.getViewportScreenBounds().width < 840;

                react("update camera", () => {
                    const isMobileNow = editor.getViewportScreenBounds().width < 840;
                    if (isMobileNow === isMobile) return;
                    isMobile = isMobileNow;
                    updateCameraBounds(isMobile);
                });

                updateCameraBounds(isMobile);
            }}
            components={components}
        />
    );
}

/**
 * Overlay component that dims areas outside PDF pages
 */
const PageOverlayScreen = track(function PageOverlayScreen({
    pdf,
    isDarkMode,
}: {
    pdf: Pdf;
    isDarkMode: boolean;
}) {
    const editor = useEditor();
    const viewportPageBounds = editor.getViewportPageBounds();

    const relevantPageBounds = pdf.pages
        .map((page) => {
            if (!viewportPageBounds.collides(page.bounds)) return null;
            return page.bounds;
        })
        .filter((bounds): bounds is Box => bounds !== null);

    function pathForPageBounds(bounds: Box) {
        return `M ${bounds.x} ${bounds.y} L ${bounds.maxX} ${bounds.y} L ${bounds.maxX} ${bounds.maxY} L ${bounds.x} ${bounds.maxY} Z`;
    }

    const viewportPath = `M ${viewportPageBounds.x} ${viewportPageBounds.y} L ${viewportPageBounds.maxX} ${viewportPageBounds.y} L ${viewportPageBounds.maxX} ${viewportPageBounds.maxY} L ${viewportPageBounds.x} ${viewportPageBounds.maxY} Z`;

    return (
        <>
            <SVGContainer className="PageOverlayScreen-screen">
                <path
                    d={`${viewportPath} ${relevantPageBounds.map(pathForPageBounds).join(" ")}`}
                    fillRule="evenodd"
                />
            </SVGContainer>
            {relevantPageBounds.map((bounds, i) => (
                <div
                    key={i}
                    className={`PageOverlayScreen-outline ${isDarkMode ? "dark-mode" : ""}`}
                    style={{
                        width: bounds.w,
                        height: bounds.h,
                        transform: `translate(${bounds.x}px, ${bounds.y}px)`,
                    }}
                />
            ))}
        </>
    );
});
