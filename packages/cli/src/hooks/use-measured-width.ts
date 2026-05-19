import * as React from "react";

interface MeasurableNode {
  width: number;
  on?(event: string, handler: () => void): void;
  off?(event: string, handler: () => void): void;
}

export function useMeasuredWidth(
  fallback: number,
): [number, (node: MeasurableNode | null) => (() => void) | void] {
  const [width, setWidth] = React.useState(fallback);
  const ref = React.useCallback((node: MeasurableNode | null) => {
    if (!node) return;
    if (node.width > 0) setWidth(node.width);
    const handler = () => {
      if (node.width > 0) setWidth(node.width);
    };
    node.on?.("resize", handler);
    return () => {
      node.off?.("resize", handler);
    };
  }, []);
  return [width, ref];
}
