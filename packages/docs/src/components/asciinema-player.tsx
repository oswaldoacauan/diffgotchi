"use client";

import "asciinema-player/dist/bundle/asciinema-player.css";
import { useEffect, useRef } from "react";

type PlayerOptions = {
  autoPlay?: boolean;
  loop?: boolean | number;
  startAt?: number | string;
  speed?: number;
  idleTimeLimit?: number;
  theme?: string;
  poster?: string;
  fit?: "width" | "height" | "both" | "none" | false;
  controls?: boolean | "auto";
  markers?: Array<[number, string]>;
  cols?: number;
  rows?: number;
  preload?: boolean;
  pauseOnMarkers?: boolean;
  terminalFontSize?: string;
  terminalFontFamily?: string;
  terminalLineHeight?: number;
};

export function AsciinemaPlayer({
  src,
  className,
  ...options
}: {
  src: string;
  className?: string;
} & PlayerOptions) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    let disposed = false;
    type PlayerInstance = { dispose?: () => void };
    let player: PlayerInstance | null = null;

    (async () => {
      const mod = await import("asciinema-player");
      if (disposed) return;
      player = mod.create(src, el, options) as PlayerInstance;
    })();

    return () => {
      disposed = true;
      player?.dispose?.();
      // Clear DOM since dispose may not fully clean up
      el.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  return <div ref={ref} className={className} />;
}
