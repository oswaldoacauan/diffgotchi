import * as React from "react";
import { RGBA } from "@opentui/core";
import { GlobalErrorBoundary } from "@/components/ui/error-boundary";

export interface DialogOverlayProps {
  entry: { element: React.ReactNode; transparent?: boolean };
  width: number;
  height: number;
  panelBg: string;
  onDismiss: () => void;
}

export function DialogOverlay({ entry, width, height, panelBg, onDismiss }: DialogOverlayProps) {
  const isTransparent = entry.transparent ?? false;

  return (
    <box
      position="absolute"
      left={0}
      top={0}
      width={width}
      height={height}
      zIndex={3000}
      alignItems="center"
      justifyContent="center"
      backgroundColor={isTransparent ? undefined : RGBA.fromInts(0, 0, 0, 150)}
      onMouseDown={() => onDismiss()}
    >
      <box
        width={Math.min(70, width - 4)}
        maxHeight={Math.floor(height * 0.7)}
        paddingTop={1}
        paddingBottom={1}
        paddingLeft={1}
        paddingRight={1}
        backgroundColor={panelBg}
        flexDirection="column"
        onMouseDown={(e: { stopPropagation?: () => void }) => e?.stopPropagation?.()}
      >
        <GlobalErrorBoundary onQuit={onDismiss}>{entry.element}</GlobalErrorBoundary>
      </box>
    </box>
  );
}
