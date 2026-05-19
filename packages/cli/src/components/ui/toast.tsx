import * as React from "react";

export interface ToastStackItem {
  id: number;
  message: string;
  variant: "info" | "success" | "warning" | "error";
}

export interface ToastStackProps {
  toasts: ToastStackItem[];
  variantColor: (variant: ToastStackItem["variant"]) => string;
  panelBg: string;
  textColor: string;
}

export function ToastStack({ toasts, variantColor, panelBg, textColor }: ToastStackProps) {
  if (toasts.length === 0) return null;

  return (
    <box position="absolute" right={2} top={1} zIndex={5000} flexDirection="column" gap={1}>
      {toasts.map((t) => (
        <box
          key={t.id}
          backgroundColor={panelBg}
          border={["left"]}
          borderStyle="heavy"
          borderColor={variantColor(t.variant)}
          paddingLeft={1}
          paddingRight={2}
          paddingTop={1}
          paddingBottom={1}
          flexDirection="row"
        >
          <text fg={textColor}>{t.message}</text>
        </box>
      ))}
    </box>
  );
}
