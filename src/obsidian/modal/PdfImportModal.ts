import { Modal, Setting, TFile } from "obsidian";
import TldrawPlugin from "src/main";

export interface PdfPageInfo {
    pageNumber: number;
    width: number;
    height: number;
}

export interface PdfImportOptions {
    selectedPages: number[];
    groupPages: boolean;
    spacing: number;
    dpi: number;
}

export class PdfImportCanceled extends Error {
    constructor() { super('PDF import canceled'); }
}

export default class PdfImportModal extends Modal {
    private selectedPages: Set<number>;
    private groupPages: boolean = false;
    private spacing: number = 100;
    private dpi: number = 150;
    private pageListEl!: HTMLElement;
    private rangeInputEl!: HTMLInputElement;

    constructor(
        private readonly plugin: TldrawPlugin,
        private readonly pdfFile: TFile,
        private readonly pages: PdfPageInfo[],
        private readonly res: (options: PdfImportOptions) => void,
        private readonly rej: (err: unknown) => void,
    ) {
        super(plugin.app);
        // All pages selected by default
        this.selectedPages = new Set(pages.map(p => p.pageNumber));
    }

    static async show(
        plugin: TldrawPlugin,
        pdfFile: TFile,
        pages: PdfPageInfo[]
    ): Promise<PdfImportOptions> {
        return new Promise((res, rej) => {
            const modal = new PdfImportModal(plugin, pdfFile, pages, res, rej);
            modal.open();
        });
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('ptl-pdf-import-modal');

        // Title
        contentEl.createEl('h2', { text: `Import PDF: ${this.pdfFile.basename}` });

        // Page selection header
        const pageHeader = contentEl.createDiv({ cls: 'ptl-pdf-import-header' });
        pageHeader.createEl('h4', { text: `Pages (${this.pages.length} total)` });

        // Select all / none buttons
        const selectBtns = pageHeader.createDiv({ cls: 'ptl-pdf-import-select-btns' });
        selectBtns.createEl('button', { text: 'All' }).onclick = () => {
            this.selectedPages = new Set(this.pages.map(p => p.pageNumber));
            this.updatePageList();
            this.updateRangeInput();
        };
        selectBtns.createEl('button', { text: 'None' }).onclick = () => {
            this.selectedPages.clear();
            this.updatePageList();
            this.updateRangeInput();
        };

        // Page range input
        const rangeContainer = contentEl.createDiv({ cls: 'ptl-pdf-import-range' });
        rangeContainer.createSpan({ text: 'Pages: ' });
        this.rangeInputEl = rangeContainer.createEl('input', {
            type: 'text',
            placeholder: `e.g. 1-3,5,7-10 (1-${this.pages.length})`,
            cls: 'ptl-pdf-import-range-input'
        });
        this.rangeInputEl.value = this.pagesToRangeString();
        this.rangeInputEl.oninput = () => {
            this.parseRangeInput(this.rangeInputEl.value);
            this.updatePageList();
        };

        // Page list with checkboxes
        this.pageListEl = contentEl.createDiv({ cls: 'ptl-pdf-import-pages' });
        this.updatePageList();

        // Options
        new Setting(contentEl)
            .setName('Group pages')
            .setDesc('Create a group containing all imported pages')
            .addToggle(toggle => toggle
                .setValue(this.groupPages)
                .onChange(value => this.groupPages = value));

        new Setting(contentEl)
            .setName('Spacing (px)')
            .setDesc('Horizontal space between this PDF and existing shapes')
            .addText(text => text
                .setValue(String(this.spacing))
                .onChange(value => {
                    const num = parseInt(value) || 100;
                    this.spacing = Math.max(0, num);
                }));

        new Setting(contentEl)
            .setName('DPI (render quality)')
            .setDesc('Higher = sharper but slower (72-300, default: 150)')
            .addText(text => text
                .setValue(String(this.dpi))
                .onChange(value => {
                    const num = parseInt(value) || 150;
                    this.dpi = Math.min(300, Math.max(72, num));
                }));

        // Buttons
        const buttonContainer = contentEl.createDiv({ cls: 'ptl-pdf-import-buttons' });

        buttonContainer.createEl('button', { text: 'Cancel' }).onclick = () => {
            this.close();
        };

        const importBtn = buttonContainer.createEl('button', {
            text: 'Import',
            cls: 'mod-cta'
        });
        importBtn.onclick = () => {
            if (this.selectedPages.size === 0) {
                return; // Nothing to import
            }
            this.res({
                selectedPages: Array.from(this.selectedPages).sort((a, b) => a - b),
                groupPages: this.groupPages,
                spacing: this.spacing,
                dpi: this.dpi,
            });
            this.close();
        };
    }

    private updatePageList(): void {
        this.pageListEl.empty();

        for (const page of this.pages) {
            const isSelected = this.selectedPages.has(page.pageNumber);
            const pageItem = this.pageListEl.createDiv({ cls: 'ptl-pdf-import-page-item' });

            const checkbox = pageItem.createEl('input', { type: 'checkbox' });
            checkbox.checked = isSelected;
            checkbox.onclick = () => {
                if (checkbox.checked) {
                    this.selectedPages.add(page.pageNumber);
                } else {
                    this.selectedPages.delete(page.pageNumber);
                }
                this.updateRangeInput();
            };

            pageItem.createSpan({ text: `Page ${page.pageNumber}` });
            pageItem.createSpan({
                text: `(${Math.round(page.width)} × ${Math.round(page.height)})`,
                cls: 'ptl-pdf-import-page-size'
            });
        }
    }

    /** Parse range string like "1-3,5,7-10" into page numbers */
    private parseRangeInput(value: string): void {
        const maxPage = this.pages.length;
        const result = new Set<number>();

        const parts = value.split(',').map(s => s.trim()).filter(s => s);
        for (const part of parts) {
            if (part.includes('-')) {
                const [startStr, endStr] = part.split('-');
                const start = parseInt(startStr) || 1;
                const end = parseInt(endStr) || maxPage;
                for (let i = Math.max(1, start); i <= Math.min(maxPage, end); i++) {
                    result.add(i);
                }
            } else {
                const num = parseInt(part);
                if (num >= 1 && num <= maxPage) {
                    result.add(num);
                }
            }
        }

        this.selectedPages = result;
    }

    /** Convert selected pages to compact range string */
    private pagesToRangeString(): string {
        const sorted = Array.from(this.selectedPages).sort((a, b) => a - b);
        if (sorted.length === 0) return '';
        if (sorted.length === this.pages.length) return `1-${this.pages.length}`;

        const ranges: string[] = [];
        let start = sorted[0];
        let end = start;

        for (let i = 1; i <= sorted.length; i++) {
            if (sorted[i] === end + 1) {
                end = sorted[i];
            } else {
                ranges.push(start === end ? String(start) : `${start}-${end}`);
                start = sorted[i];
                end = start;
            }
        }

        return ranges.join(',');
    }

    private updateRangeInput(): void {
        this.rangeInputEl.value = this.pagesToRangeString();
    }

    onClose(): void {
        this.rej(new PdfImportCanceled());
    }
}
