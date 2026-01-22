import { FileView, TFile } from "obsidian";
import { Root } from "react-dom/client";
import TldrawPlugin from "src/main";
import { MARKDOWN_ICON_NAME, VIEW_TYPE_MARKDOWN } from "src/utils/constants";
import { createRootAndRenderTldrawApp, TldrawAppProps, TldrawAppStoreProps } from "src/components/TldrawApp";
import TldrawAssetsModal from "./modal/TldrawAssetsModal";
import { parseDeepLinkString, TLDeepLink } from "tldraw";
import InFrontOfTheCanvas from "src/components/InFrontOfTheCanvas";

/**
 * Implements overrides for {@linkcode FileView.onload} and {@linkcode FileView.onunload}
 * as a mixin so that it could be reused.
 * 
 * @param Base 
 * @returns 
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function TldrawLoadableMixin<T extends abstract new (...args: any[]) => FileView>(Base: T) {
    /**
     * #NOTE: may need to embed the react root in an iframe so that the right click context menus are positioned within the frame, and not partially hidden.
     */
    abstract class _TldrawLoadableMixin extends Base {
        abstract plugin: TldrawPlugin;
        private reactRoot?: Root;
        private onUnloadCallbacks: (() => void)[] = [];

        #storeProps?: TldrawAppStoreProps;
        #deepLink?: TLDeepLink;

        #unregisterViewAssetsActionCallback?: () => void;
        #unregisterOnWindowMigrated?: () => void;

        protected get tldrawContainer() { return this.contentEl; }

        /**
         * Adds the entry point `tldraw-view-content` for the {@linkcode reactRoot},
         * and the "View as markdown" action button.
         */
        override onload(): void {
            super.onload();
            this.contentEl.addClass("tldraw-view-content");

            this.#unregisterOnWindowMigrated?.();
            this.#unregisterOnWindowMigrated = this.contentEl.onWindowMigrated(() => {
                this.refreshView();
            })

            this.addAction(MARKDOWN_ICON_NAME, "View as markdown", () => this.viewAsMarkdownClicked());
        }

        /**
         * Removes the previously added entry point `tldraw-view-content`, and unmounts {@linkcode reactRoot}.
         */
        override onunload(): void {
            this.#unregisterOnWindowMigrated?.();
            this.contentEl.removeClass("tldraw-view-content");
            this.unmountReactRoot();
            super.onunload();
        }

        override onUnloadFile(file: TFile): Promise<void> {
            const callbacks = [...this.onUnloadCallbacks];
            this.onUnloadCallbacks = [];
            callbacks.forEach((e) => e());
            return super.onUnloadFile(file);
        }

        public registerOnUnloadFile(cb: () => void) {
            this.onUnloadCallbacks.push(cb);
        }

        setEphemeralState(state: unknown): void {
            // If a deep link is present when the document is opened, set the deeplink variable so the editor is opened at the deep link.
            if (
                typeof state === 'object' && state
                && 'tldrawDeepLink' in state
                && typeof state.tldrawDeepLink === 'string'
            ) {
                const tldrawDeepLink = state.tldrawDeepLink;
                try {
                    this.#deepLink = parseDeepLinkString(tldrawDeepLink);
                    return;
                } catch (e) {
                    console.error('Unable to parse deeplink:', tldrawDeepLink);
                }
            }
        }

        protected getTldrawOptions(): TldrawAppProps['options'] {
            return {
                components: {
                    InFrontOfTheCanvas,
                },
                onEditorMount: (editor) => {
                    const viewState = this.getEphemeralState();
                    console.log(this.#deepLink)
                    console.log({ viewState })
                    if (this.#deepLink) {
                        console.log(this.#deepLink)
                        editor.navigateToDeepLink(this.#deepLink);
                        return;
                    }
                    return editor.resetZoom();
                }
            };
        }

        private createReactRoot(entryPoint: Element, store: TldrawAppStoreProps) {
            return createRootAndRenderTldrawApp(
                entryPoint,
                this.plugin,
                {
                    app: this.getTldrawOptions(),
                    store,
                }
            );
        }

        /**
         * Set the store props to be used inside the react root element.
         * @param storeProps 
         * @returns 
         */
        protected async setStore(storeProps?: TldrawAppStoreProps) {
            this.#storeProps = storeProps;
            this.updateViewAssetsAction();
            this.refreshView();
        }

        protected viewAsMarkdownClicked() {
            this.plugin.updateViewMode(VIEW_TYPE_MARKDOWN);
        }

        private updateViewAssetsAction() {
            const storeProps = this.#storeProps;
            this.#unregisterViewAssetsActionCallback?.();
            if (!storeProps) return;

            const viewAssetsAction = this.addAction('library', 'View assets', () => {
                const assetsModal = new TldrawAssetsModal(this.app, storeProps, this.file)
                assetsModal.open();
                this.registerOnUnloadFile(() => assetsModal.close());
            });

            const removeCb = () => {
                viewAssetsAction.remove()
            };
            this.registerOnUnloadFile(removeCb);
            this.#unregisterViewAssetsActionCallback = () => {
                console.log('unregisterViewAssetsActionCallback')
                this.onUnloadCallbacks.remove(removeCb);
                removeCb();
            }
        }

        private unmountReactRoot() {
            this.reactRoot?.unmount();
            this.reactRoot = undefined;
        }

        async refreshView() {
            const storeProps = this.#storeProps;
            this.unmountReactRoot();
            if (!storeProps) return;
            this.reactRoot = this.createReactRoot(this.tldrawContainer, storeProps);
        }
    }

    return _TldrawLoadableMixin;
}
