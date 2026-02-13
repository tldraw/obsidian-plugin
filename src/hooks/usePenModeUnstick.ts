import * as React from "react";
import { Editor } from "tldraw";

/**
 * Prevents tldraw from getting stuck in pen mode when switching from stylus
 * input to mouse / trackpad input.
 */
export function usePenModeUnstick(editor: Editor | null) {
	React.useEffect(() => {
		if (!editor) return;

		editor.updateInstanceState({ isPenMode: false });

		const container = editor.getContainer();

		const handlePointerDown = (e: PointerEvent) => {
			const isNonPen = e.pointerType === "mouse" || e.pointerType === "touch";
			if (isNonPen && editor.getInstanceState().isPenMode) {
				editor.updateInstanceState({ isPenMode: false });
			}
		};

		container.addEventListener("pointerdown", handlePointerDown, true);

		return () => {
			container.removeEventListener("pointerdown", handlePointerDown, true);
		};
	}, [editor]);
}
