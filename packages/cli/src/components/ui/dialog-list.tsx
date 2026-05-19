import * as React from "react";
import { RGBA, TextAttributes, ScrollBoxRenderable } from "@opentui/core";
import type { ParsedKey } from "@opentui/core";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { useAtomValue } from "jotai/react";
import { resolvedThemeAtom } from "@/atoms/derived";
import { rgbaToHex, contrastFg } from "@/lib/themes";
import { useMeasuredWidth } from "@/hooks/use-measured-width";
import { useKeybind } from "@/providers/keybind";

export interface DialogListProps {
  title: string;
  placeholder?: string;
  count: number;
  children: (ctx: {
    active: number;
    width: number;
    accent: string;
    fg: (i: number) => string;
    muted: (i: number) => string;
  }) => React.ReactNode;
  initialIndex?: number;
  onSelect?: (index: number) => void;
  onEscape?: () => void;
  onHighlight?: (index: number) => void;
  onKey?: (key: ParsedKey, index: number) => boolean | void;
  onSearchChange?: (search: string) => void;
  footer?: React.ReactNode;
  visibleRows?: number;
}

const TRANSPARENT = RGBA.fromInts(0, 0, 0, 0);

export function DialogList({
  title,
  placeholder = "Search...",
  count,
  children,
  onSelect,
  onEscape,
  onHighlight,
  onKey,
  onSearchChange,
  initialIndex,
  footer,
  visibleRows,
}: DialogListProps) {
  const { theme } = useAtomValue(resolvedThemeAtom);
  const keybind = useKeybind();
  const { height: termHeight } = useTerminalDimensions();
  const maxItems = Math.max(4, Math.floor(termHeight * 0.4));
  const listHeight = Math.min(visibleRows ?? count, maxItems);

  const [contentWidth, rootRef] = useMeasuredWidth(60);

  const scrollRef = React.useRef<ScrollBoxRenderable | null>(null);

  const text = rgbaToHex(theme.text);
  const textMuted = rgbaToHex(theme.textMuted);
  const accent = rgbaToHex(theme.primary);
  const activeFg = contrastFg(theme.primary);
  const panelBg = rgbaToHex(theme.backgroundPanel);

  const [activeIndex, setActiveIndex] = React.useState(initialIndex ?? 0);
  const lastSearchRef = React.useRef("");

  const clamped = Math.min(activeIndex, Math.max(0, count - 1));

  React.useEffect(() => {
    onHighlight?.(clamped);
  }, [clamped, onHighlight]);

  React.useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const target = scroll.getChildren().find((child) => child.id === `dlr-${clamped}`);
    if (!target) return;
    const y = target.y - scroll.y;
    if (y < 0) scroll.scrollBy(y);
    else if (y >= scroll.height) scroll.scrollBy(y - scroll.height + 1);
  }, [clamped]);

  function move(dir: number) {
    if (count === 0) return;
    setActiveIndex((prev) => (prev + dir + count) % count);
  }

  const callbacksRef = React.useRef({ onKey, onEscape, onSelect });
  callbacksRef.current = { onKey, onEscape, onSelect };

  useKeyboard((key) => {
    const { onKey: _onKey, onEscape: _onEscape, onSelect: _onSelect } = callbacksRef.current;
    if (_onKey?.(key, clamped)) return;
    if (keybind.matchInContext("select", "cancel", key)) {
      _onEscape?.();
      return;
    }
    if (keybind.matchInContext("select", "accept", key)) {
      if (count > 0) _onSelect?.(clamped);
      return;
    }
    if (keybind.matchInContext("select", "prev", key)) {
      move(-1);
      return;
    }
    if (keybind.matchInContext("select", "next", key)) {
      move(1);
      return;
    }
  });

  const fg = (i: number) => (i === clamped ? activeFg : text);
  const muted = (i: number) => (i === clamped ? activeFg : textMuted);

  return (
    <box ref={rootRef} gap={1}>
      <box paddingLeft={1} paddingRight={1}>
        <box flexDirection="row" justifyContent="space-between">
          <text fg={text} attributes={TextAttributes.BOLD}>
            {title}
          </text>
          <text fg={textMuted}>esc</text>
        </box>
        <box paddingTop={1}>
          <input
            onInput={(e: string) => {
              if (e !== lastSearchRef.current) {
                lastSearchRef.current = e;
                setActiveIndex(0);
                onSearchChange?.(e);
              }
            }}
            focusedBackgroundColor={theme.backgroundPanel}
            cursorColor={theme.primary}
            focusedTextColor={theme.textMuted}
            ref={(r: any) => {
              if (!r) return;
              setTimeout(() => {
                if (r.isDestroyed) return;
                r.focus();
              }, 1);
            }}
            placeholder={placeholder}
            placeholderColor={theme.textMuted}
          />
        </box>
      </box>

      {count > 0 ? (
        <scrollbox
          ref={scrollRef}
          scrollY
          flexShrink={0}
          height={listHeight}
          scrollbarOptions={{ visible: false }}
          style={{
            rootOptions: { backgroundColor: panelBg, border: false },
          }}
        >
          {children({ active: clamped, width: contentWidth, accent, fg, muted })}
        </scrollbox>
      ) : (
        <box paddingLeft={1} paddingRight={1}>
          <text fg={textMuted}>No results</text>
        </box>
      )}

      {footer && (
        <box paddingLeft={1} paddingRight={1}>
          {footer}
        </box>
      )}
    </box>
  );
}

export function DialogListRow({
  index,
  active,
  children,
}: {
  index: number;
  active: number;
  children: React.ReactNode;
}) {
  const { theme } = useAtomValue(resolvedThemeAtom);
  const isActive = index === active;

  return (
    <box
      id={`dlr-${index}`}
      flexDirection="row"
      position="relative"
      gap={1}
      paddingLeft={1}
      paddingRight={1}
      backgroundColor={isActive ? theme.primary : TRANSPARENT}
    >
      {children}
    </box>
  );
}
