"use client";

import { type MutableRefObject, useEffect, useState } from "react";

/**
 * Tracks which element in a list is "active" — closest to a viewport trigger line.
 * Used by scrolly-style layouts to decide which feature is in focus.
 */
export function useActiveSection(
  refs: MutableRefObject<Array<HTMLElement | null>>,
  options: { triggerRatio?: number; rootMargin?: string } = {},
) {
  const { triggerRatio = 0.4, rootMargin = "-30% 0px -40% 0px" } = options;
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const sections = refs.current.filter((s): s is HTMLElement => s !== null);
    if (sections.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .map((e) => ({
            idx: sections.indexOf(e.target as HTMLElement),
            top: e.boundingClientRect.top,
          }))
          .filter((v) => v.idx !== -1);
        if (visible.length === 0) return;
        const triggerY = window.innerHeight * triggerRatio;
        visible.sort((a, b) => Math.abs(a.top - triggerY) - Math.abs(b.top - triggerY));
        setActiveIdx(visible[0].idx);
      },
      { rootMargin, threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    sections.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, [refs, rootMargin, triggerRatio]);

  return activeIdx;
}
