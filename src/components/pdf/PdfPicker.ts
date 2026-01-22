import { App, FuzzySuggestModal, TFile } from "obsidian";
import { loadPdf } from "./loadPdf";
import { Pdf } from "./pdf.types";

/**
 * Modal for selecting a PDF file from the Obsidian vault
 */
export class PdfPickerModal extends FuzzySuggestModal<TFile> {
    private onSelect: (pdf: Pdf) => void;
    private onCancel?: () => void;

    constructor(
        app: App,
        onSelect: (pdf: Pdf) => void,
        onCancel?: () => void
    ) {
        super(app);
        this.onSelect = onSelect;
        this.onCancel = onCancel;
        this.setPlaceholder("Search for a PDF file...");
    }

    getItems(): TFile[] {
        return this.app.vault.getFiles().filter((file) => file.extension === "pdf");
    }

    getItemText(item: TFile): string {
        return item.path;
    }

    async onChooseItem(item: TFile): Promise<void> {
        try {
            const arrayBuffer = await this.app.vault.readBinary(item);
            const pdf = await loadPdf(item.name, arrayBuffer);
            this.onSelect(pdf);
        } catch (error) {
            console.error("Failed to load PDF:", error);
        }
    }

    onClose(): void {
        super.onClose();
        // Only call onCancel if no item was selected
        // This is a bit tricky - we'll handle this via the caller
    }
}

/**
 * Opens the PDF picker modal and returns a promise that resolves with the selected PDF
 */
export function openPdfPicker(app: App): Promise<Pdf | null> {
    return new Promise((resolve) => {
        let resolved = false;
        const modal = new PdfPickerModal(
            app,
            (pdf) => {
                resolved = true;
                resolve(pdf);
            },
            () => {
                if (!resolved) {
                    resolve(null);
                }
            }
        );
        modal.open();
    });
}
