import * as React from "react";
import { TextAttributes } from "@opentui/core";
import { useKeyboard, useRenderer } from "@opentui/react";
import { useAtomValue } from "jotai/react";
import { resolvedThemeAtom } from "@/atoms/derived";
import { KeybindHint } from "@/components/ui/keybind-hint";
import { rgbaToHex } from "@/lib/themes";
import { copySelection } from "@/util/selection";
import { copy as clipboardCopy } from "@/util/clipboard";
import { useKeybind } from "@/providers/keybind";

function useErrorTheme() {
  const { theme } = useAtomValue(resolvedThemeAtom);
  return React.useMemo(() => {
    return {
      bg: theme.background,
      panelBg: theme.backgroundPanel,
      text: rgbaToHex(theme.text),
      muted: rgbaToHex(theme.textMuted),
      error: rgbaToHex(theme.error),
      primary: rgbaToHex(theme.primary),
    };
  }, [theme]);
}

function GlobalErrorFallback({
  error,
  onReset,
  onQuit,
}: {
  error: Error;
  onReset: () => void;
  onQuit: () => void;
}) {
  const renderer = useRenderer();
  const colors = useErrorTheme();
  const keybind = useKeybind();
  const [copied, setCopied] = React.useState(false);
  const copiedTimerRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);

  React.useEffect(() => () => clearTimeout(copiedTimerRef.current), []);

  useKeyboard((key) => {
    if (keybind.matchInContext("error", "retry", key)) {
      onReset();
      return;
    }
    if (keybind.matchInContext("error", "copy", key)) {
      const text = `${error.message}\n${error.stack ?? ""}`;
      clipboardCopy(text);
      setCopied(true);
      clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
      return;
    }
    if (keybind.matchInContext("error", "quit", key)) {
      onQuit();
    }
  });

  return (
    <box
      flexDirection="column"
      padding={2}
      gap={1}
      backgroundColor={colors.bg}
      height="100%"
      onMouseUp={() => copySelection(renderer)}
    >
      <text fg={colors.error} attributes={TextAttributes.BOLD}>
        Something went wrong
      </text>

      <text fg={colors.text} attributes={TextAttributes.BOLD}>
        {error.message}
      </text>

      {error.stack && (
        <scrollbox
          scrollY
          maxHeight={20}
          scrollbarOptions={{ visible: false }}
          style={{ rootOptions: { backgroundColor: colors.panelBg, border: false } }}
        >
          <box backgroundColor={colors.panelBg} padding={1}>
            <text fg={colors.muted} wrapMode="none">
              {error.stack}
            </text>
          </box>
        </scrollbox>
      )}

      <text fg={colors.muted}>Your progress is preserved.</text>

      <box paddingTop={1} flexDirection="row" gap={2}>
        <box>
          <KeybindHint command="error.retry" label="retry" />
        </box>
        <box>
          <KeybindHint command="error.copy" label={copied ? "copied!" : "copy error"} />
        </box>
        <box>
          <KeybindHint command="error.quit" label="quit" />
        </box>
      </box>
    </box>
  );
}

interface GlobalErrorBoundaryProps {
  children: React.ReactNode;
  onQuit?: () => void;
}

interface GlobalErrorBoundaryState {
  error: Error | null;
}

export class GlobalErrorBoundary extends React.Component<
  GlobalErrorBoundaryProps,
  GlobalErrorBoundaryState
> {
  state: GlobalErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): GlobalErrorBoundaryState {
    return { error };
  }

  render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <GlobalErrorFallback
        error={error}
        onReset={() => this.setState({ error: null })}
        onQuit={() => this.props.onQuit?.()}
      />
    );
  }
}
