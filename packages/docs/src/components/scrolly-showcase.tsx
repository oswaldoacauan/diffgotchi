"use client";

import { motion, useMotionValueEvent, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useMediaQuery, useResizeObserver } from "usehooks-ts";
import { DemoTerminal } from "@/components/demo-terminal";
import { FeatureArticle } from "@/components/feature-article";
import { HeroContent } from "@/components/hero-content";
import { TerminalChrome } from "@/components/landing";
import { AsciinemaPlayer } from "@/components/asciinema-player";
import { FEATURES } from "@/data/features";
import { useActiveSection } from "@/hooks/use-active-section";

const HERO_DEMO = { id: "review", cast: "/demos/hero.cast" } as const;
const TERMINAL_DEMOS = [HERO_DEMO, ...FEATURES];

const DESKTOP_QUERY = "(min-width: 1024px)";
const COL_GAP_PX = 64;
const TERMINAL_COL_RATIO = 0.55;
const HERO_FADE_END = 0.7;
const ARTICLES_FADE_START = 0.3;

function MobileLayout() {
  return (
    <div className="flex flex-col gap-[clamp(3rem,8vw,5rem)] px-[clamp(1rem,4vw,2rem)] pb-[clamp(3rem,6vw,5rem)] pt-[clamp(2.5rem,6vw,4rem)]">
      <HeroContent align="left" />

      <div className="flex flex-col gap-[clamp(2.5rem,6vw,4rem)]">
        {FEATURES.map((feature) => (
          <FeatureArticle
            key={feature.id}
            feature={feature}
            variant="mobile"
            demoSlot={
              <DemoTerminal
                cast={feature.cast}
                label={`diffgotchi · ${feature.id}`}
                fontSize="0.8rem"
                className="mb-5 rounded-xl"
              />
            }
          />
        ))}
      </div>
    </div>
  );
}

function DesktopLayout() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Array<HTMLElement | null>>([]);

  const { width: gridW = 0 } = useResizeObserver({ ref: gridRef });
  const { height: termH = 0 } = useResizeObserver({ ref: terminalRef });

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "60vh start"],
  });

  const terminalW = gridW * TERMINAL_COL_RATIO;
  const translateX = useTransform(scrollYProgress, (p) => (gridW - terminalW) * (1 - p));
  const heroOpacity = useTransform(scrollYProgress, [0, HERO_FADE_END], [1, 0]);
  const heroPointer = useTransform(heroOpacity, (o) => (o < 0.1 ? "none" : "auto"));
  const articlesOpacity = useTransform(scrollYProgress, [ARTICLES_FADE_START, 1], [0, 1]);

  const articleIdx = useActiveSection(sectionRefs);

  // Hero cast plays while the hero overlay is on screen. Once it fades out,
  // the terminal switches to whichever feature article is in focus.
  const [phase, setPhase] = useState<"hero" | "articles">("hero");
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setPhase(v > HERO_FADE_END ? "articles" : "hero");
  });
  const terminalIdx = phase === "hero" ? 0 : articleIdx + 1;

  return (
    <div
      ref={containerRef}
      className="relative px-[clamp(1rem,4vw,4rem)] pb-[clamp(4rem,8vw,8rem)]"
    >
      {/* Hero overlay — sticky, fades as user scrolls. */}
      <motion.div
        className="sticky top-0 z-10 h-screen"
        style={{
          marginBottom: "-100vh",
          opacity: heroOpacity,
          pointerEvents: heroPointer,
        }}
      >
        <div className="flex h-full items-center">
          <div style={{ width: gridW > 0 ? `${gridW - terminalW - COL_GAP_PX}px` : "100%" }}>
            <div className="ml-auto">
              <HeroContent align="right" />
            </div>
          </div>
        </div>
      </motion.div>

      <div
        ref={gridRef}
        className="relative grid grid-cols-[55%_1fr]"
        style={{ columnGap: `${COL_GAP_PX}px` }}
      >
        {/* Terminal column — pointer-events-none so empty space doesn't block hero links. */}
        <div className="pointer-events-none relative z-20">
          <motion.div
            ref={terminalRef}
            className="pointer-events-auto sticky w-full overflow-hidden rounded-2xl border border-ctp-surface0 bg-ctp-mantle shadow-2xl shadow-landing-text/15"
            style={{
              top: termH > 0 ? `max(calc(50vh - ${termH / 2}px), 2rem)` : "2rem",
              x: translateX,
            }}
          >
            <TerminalChrome label={`diffgotchi · ${TERMINAL_DEMOS[terminalIdx].id}`} />
            <div className="relative bg-ctp-mantle">
              {TERMINAL_DEMOS.map((demo, i) => (
                <div
                  key={demo.id}
                  aria-hidden={i !== terminalIdx}
                  className={i === 0 ? "relative" : "absolute inset-0"}
                  style={{
                    opacity: i === terminalIdx ? 1 : 0,
                    transition: "opacity 150ms ease",
                    pointerEvents: i === terminalIdx ? "auto" : "none",
                  }}
                >
                  <AsciinemaPlayer
                    src={demo.cast}
                    autoPlay
                    loop
                    preload
                    controls={false}
                    fit="width"
                    terminalFontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
                    terminalFontSize="1rem"
                    idleTimeLimit={2}
                  />
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <motion.div
          className="flex flex-col gap-[max(8vh,4rem)] pt-[110vh]"
          style={{ opacity: articlesOpacity }}
        >
          {FEATURES.map((feature, i) => (
            <FeatureArticle
              key={feature.id}
              ref={(el) => {
                sectionRefs.current[i] = el;
              }}
              feature={feature}
              variant="desktop"
              active={articleIdx === i}
            />
          ))}
          <div aria-hidden />
        </motion.div>
      </div>
    </div>
  );
}

export function ScrollyShowcase() {
  const isDesktop = useMediaQuery(DESKTOP_QUERY, { initializeWithValue: false });
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  return (
    <section
      aria-label="Feature showcase"
      className="relative mx-auto w-full max-w-[110rem]"
      style={{
        opacity: isHydrated ? 1 : 0,
        pointerEvents: isHydrated ? "auto" : "none",
        transition: "opacity 180ms ease",
      }}
    >
      {isDesktop ? <DesktopLayout /> : <MobileLayout />}
    </section>
  );
}
