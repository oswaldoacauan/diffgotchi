import * as React from "react";
import { useAtomValue } from "jotai/react";
import { resolvedThemeAtom } from "@/atoms/derived";
import { rgbaToHex } from "@/lib/themes";
import { ToastStack } from "@/components/ui/toast";

interface ToastItem {
  id: number;
  message: string;
  variant: "info" | "success" | "warning" | "error";
}

interface ToastContextValue {
  show(message: string, variant?: ToastItem["variant"]): void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const timersRef = React.useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const { theme } = useAtomValue(resolvedThemeAtom);

  React.useEffect(() => () => timersRef.current.forEach((t) => clearTimeout(t)), []);

  const show = React.useCallback((message: string, variant: ToastItem["variant"] = "info") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, variant }]);
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timersRef.current.delete(id);
    }, 4000);
    timersRef.current.set(id, timer);
  }, []);

  const value = React.useMemo(() => ({ show }), [show]);

  const variantColor = (v: ToastItem["variant"]) => {
    switch (v) {
      case "success":
        return rgbaToHex(theme.success);
      case "error":
        return rgbaToHex(theme.error);
      case "warning":
        return rgbaToHex(theme.warning);
      default:
        return rgbaToHex(theme.primary);
    }
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastStack
        toasts={toasts}
        variantColor={variantColor}
        panelBg={rgbaToHex(theme.backgroundPanel)}
        textColor={rgbaToHex(theme.text)}
      />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
