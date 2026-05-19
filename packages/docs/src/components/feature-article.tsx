import { forwardRef } from "react";
import type { Feature } from "@/data/features";

type Variant = "mobile" | "desktop";

const STYLES: Record<Variant, { wrapper: string; title: string; body: string }> = {
  mobile: {
    wrapper: "flex flex-col",
    title:
      "mb-4 font-kawaii text-[clamp(1.75rem,5vw,2.25rem)] leading-[1.1] tracking-tight text-landing-text",
    body: "space-y-3 font-mono text-[0.875rem] leading-[1.7] text-landing-muted",
  },
  desktop: {
    wrapper:
      "group flex min-h-[45vh] flex-col justify-center transition-opacity duration-500 data-[active=false]:opacity-50",
    title:
      "mb-6 max-w-[24rem] font-kawaii text-[clamp(2rem,4vw,3rem)] leading-[1.05] tracking-tight text-landing-text",
    body: "max-w-[30rem] space-y-4 font-mono text-[clamp(0.85rem,1.05vw,0.95rem)] leading-[1.75] text-landing-muted",
  },
};

export const FeatureArticle = forwardRef<
  HTMLElement,
  { feature: Feature; variant: Variant; active?: boolean; demoSlot?: React.ReactNode }
>(function FeatureArticle({ feature, variant, active, demoSlot }, ref) {
  const s = STYLES[variant];
  return (
    <article ref={ref} data-active={active} className={s.wrapper}>
      <p className="mb-2 font-mono text-[0.7rem] font-bold uppercase tracking-[0.2em] text-mauve lg:mb-3">
        {feature.label}
      </p>
      <h2 className={s.title}>{feature.title}</h2>
      {demoSlot}
      <div className={s.body}>{feature.body}</div>
    </article>
  );
});
