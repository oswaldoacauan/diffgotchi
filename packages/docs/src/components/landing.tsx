import type { ReactNode } from "react";

export const INSTALL_COMMAND = "brew install oswaldoacauan/diffgotchi/diffgotchi";

export const OG_IMAGE = "https://diffgotchi.dev/demos/diff-view.png";
export const SITE_TITLE = "diffgotchi — a terminal diff reviewer for the code your agent writes.";

export function MetaTags() {
  return (
    <>
      <title>{SITE_TITLE}</title>
      <meta
        name="description"
        content="A terminal diff reviewer for code your agent writes. Drop comments, hand the loop back, come back to a green panel."
      />
      <meta property="og:type" content="website" />
      <meta property="og:title" content={SITE_TITLE} />
      <meta
        property="og:description"
        content="Review your agent's diff in the terminal. Drop comments, hand the loop back."
      />
      <meta property="og:image" content={OG_IMAGE} />
      <meta property="og:image:width" content="1920" />
      <meta property="og:image:height" content="1080" />
      <meta property="og:image:alt" content="Diffgotchi TUI diff view with syntax highlighting" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={SITE_TITLE} />
      <meta name="twitter:description" content="Review your agent's diff in the terminal." />
      <meta name="twitter:image" content={OG_IMAGE} />
    </>
  );
}

export function TerminalChrome({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1.5 border-b border-ctp-surface0/60 bg-ctp-mantle px-4 py-3">
      <div className="size-3 rounded-full bg-red/80" />
      <div className="size-3 rounded-full bg-yellow/80" />
      <div className="size-3 rounded-full bg-green/80" />
      <span className="ml-3 font-mono text-[0.7rem] font-medium text-ctp-subtext0">{label}</span>
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-landing-text/[0.12] bg-landing-button-bg px-1.5 py-0.5 font-mono text-[0.85em] text-landing-text">
      {children}
    </kbd>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-landing-text/[0.06] px-1.5 py-0.5 font-mono text-[0.85em] text-landing-text">
      {children}
    </code>
  );
}
