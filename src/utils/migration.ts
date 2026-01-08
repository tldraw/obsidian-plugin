import { Editor, createShapeId } from "tldraw";

/**
 * Upgrades legacy PDF 'image' shapes to new 'pdf-page' shapes.
 * Keeps position, size, and rotation.
 * Deletes the old image shape and its associated asset.
 */
export function upgradeLegacyPdfShapes(editor: Editor) {
    // We only run this once per session ideally, or efficiently.
    // Scan all shapes.

    const shapesToUpgrade: any[] = [];
    const assetsToDelete: any[] = [];
    const shapesToDelete: any[] = [];

    const shapes = editor.getCurrentPageShapes(); // Or all pages? Better just current page to be safe/fast initially.
    // actually better to check all shapes in store if possible, but store.allRecords() is safer.

    const allShapes = editor.store.allRecords().filter(r => r.typeName === 'shape' && r.type === 'image');

    for (const shape of allShapes as any[]) {
        if (shape.meta?.isPdfPage && shape.meta?.pdfPath) {
            // Found a candidate
            shapesToUpgrade.push(shape);
        }
    }

    if (shapesToUpgrade.length === 0) return;

    console.log(`[Migration] Upgrading ${shapesToUpgrade.length} legacy PDF shapes...`);

    editor.run(() => {
        const newShapes: any[] = [];

        for (const oldShape of shapesToUpgrade) {
            // Create new shape
            // We use a new ID to avoid type conflicts during swap, 
            // but we could try to reuse ID if we delete first. 
            // Reuse ID is better for bindings (arrows).
            const id = oldShape.id;
            const assetId = oldShape.props.assetId;

            // Prepare new shape record
            const newShape = {
                id,
                type: 'pdf-page',
                x: oldShape.x,
                y: oldShape.y,
                rotation: oldShape.rotation,
                index: oldShape.index,
                parentId: oldShape.parentId,
                opacity: oldShape.opacity,
                isLocked: oldShape.isLocked,
                props: {
                    pdfPath: oldShape.meta.pdfPath,
                    pageNumber: oldShape.meta.pageNumber,
                    w: oldShape.props.w,
                    h: oldShape.props.h,
                },
                meta: {
                    ...oldShape.meta,
                    isLegacyUpgraded: true,
                }
            };

            newShapes.push(newShape);

            if (assetId) {
                assetsToDelete.push(assetId);
            }
            shapesToDelete.push(id);
        }

        // Delete old shapes first (to free up IDs)
        editor.deleteShapes(shapesToDelete);

        // Create new shapes (reusing IDs)
        editor.createShapes(newShapes);

        // Cleanup assets
        if (assetsToDelete.length > 0) {
            editor.deleteAssets(assetsToDelete);
        }
    });

    console.log(`[Migration] Upgrade complete. Removed ${assetsToDelete.length} obsolete assets.`);
}
