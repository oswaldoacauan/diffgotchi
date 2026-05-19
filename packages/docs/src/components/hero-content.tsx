import { CopyButton } from "@/components/copy-button";
import { INSTALL_COMMAND } from "@/components/landing";

export function HeroContent({ align = "left" }: { align?: "left" | "right" }) {
  const isRight = align === "right";
  return (
    <div
      className={`flex w-full flex-col lg:max-w-[32rem] ${isRight ? "items-end text-right" : "items-start text-left"}`}
    >
      <div className="mb-5 flex items-center gap-3">
        <img
          src="/favicon-256.png"
          alt=""
          width={48}
          height={48}
          decoding="async"
          fetchPriority="high"
          className="h-12 w-12 rounded-xl object-cover"
        />
        <span className="font-kawaii text-[1.85rem] leading-none text-landing-text">
          diffgotchi
        </span>
      </div>

      <h1 className="mb-5 font-mono text-[clamp(1.4rem,2.4vw,2.1rem)] font-bold leading-[1.15] tracking-tight text-landing-text">
        review your agent's diff <span className="italic text-mauve">in the terminal.</span>
      </h1>

      <div className="mb-6 flex items-center gap-3" aria-hidden="true">
        <span className="grid size-4 place-items-center font-mono text-[1.1rem] font-bold leading-none text-green">
          +
        </span>
        <span className="grid size-4 place-items-center font-mono text-[1.1rem] font-bold leading-none text-red">
          -
        </span>
        <span className="grid size-4 place-items-center font-mono text-[1.1rem] font-bold leading-none text-yellow">
          •
        </span>
      </div>

      <div className="mb-6 space-y-3 font-mono text-[0.875rem] leading-[1.7] text-landing-muted">
        <p>
          <strong className="font-medium text-landing-text">
            A diff reviewer that lives where the work does.
          </strong>
        </p>
        <p>
          Scroll the diff, drop comments on the lines that need a second look, mark files{" "}
          <span className="text-green">done</span>. The view refreshes the moment your agent touches
          a file. Your comments stay pinned across rebases and branch switches.
        </p>
        <p>Hand the loop off to your agent and come back to a green panel.</p>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="relative inline-flex items-center gap-2 rounded-md border border-ctp-surface0 bg-ctp-mantle py-2.5 pl-3.5 pr-12 font-mono text-[0.85rem]">
          <span className="text-green">$</span>
          <code className="text-ctp-text">
            <span className="text-blue">brew</span> <span className="text-mauve">install</span>{" "}
            <span className="text-yellow">oswaldoacauan/diffgotchi/diffgotchi</span>
          </code>
          <CopyButton text={INSTALL_COMMAND} />
        </div>
      </div>

      <p className="font-mono text-[0.7rem] text-landing-muted/80">
        <a
          href="https://github.com/oswaldoacauan/diffgotchi"
          target="_blank"
          rel="noopener noreferrer"
          className="text-landing-muted hover:text-landing-text"
        >
          github
        </a>{" "}
        ·{" "}
        <a href="/docs" className="text-landing-muted hover:text-landing-text">
          docs
        </a>
      </p>
    </div>
  );
}
