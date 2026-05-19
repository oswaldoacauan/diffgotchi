import { atom } from "jotai";
import { defaultThemeName } from "@/lib/themes";

export interface StartupToast {
  message: string;
  variant: "info" | "success" | "warning" | "error";
}

export const terminalWidthAtom = atom(80);
export const browsingAtom = atom(false);
export const themeNameAtom = atom(defaultThemeName);
export const startupToastsAtom = atom<StartupToast[]>([]);
export const diffTruncatedAtom = atom(false);
export const diffTotalBytesAtom = atom(0);
export const forceExpandedFilesAtom = atom<Record<string, boolean>>({});
export const forceExpandVersionAtom = atom(0);
export const keybindContextAtom = atom("diff");
