import { copy as clipboardCopy } from "@/util/clipboard";

interface SelectionHost {
  getSelection(): { getSelectedText(): string | null } | null;
  clearSelection(): void;
}

interface ToastHost {
  show(message: string, variant: "success" | "error" | "info" | "warning"): void;
}

export function copySelection(renderer: SelectionHost, toast?: ToastHost): boolean {
  const sel = renderer.getSelection();
  if (!sel) return false;
  const text = sel.getSelectedText();
  if (!text) return false;
  try {
    clipboardCopy(text);
    toast?.show("Copied", "success");
  } catch {
    toast?.show("Copy failed", "error");
  }
  renderer.clearSelection();
  return true;
}
