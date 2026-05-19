"use client";

import { Check, Copy } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const COPIED_RESET_MS = 1500;

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    setCopied(true);
    timerRef.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "Install commands copied" : "Copy install commands"}
      className="absolute right-2 top-1/2 z-10 grid h-7 w-7 -translate-y-1/2 cursor-pointer place-items-center border-0 bg-transparent p-0 text-ctp-subtext0 hover:text-pink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mauve"
    >
      <Copy
        aria-hidden
        className={`h-[1.05rem] w-[1.05rem] transition-opacity duration-150 ${copied ? "opacity-0" : "opacity-[0.72]"}`}
      />
      <Check
        aria-hidden
        className={`pointer-events-none absolute h-[1.05rem] w-[1.05rem] text-green transition-opacity duration-150 ${copied ? "opacity-100" : "opacity-0"}`}
      />
    </button>
  );
}
