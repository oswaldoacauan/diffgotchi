import { MetaTags } from "@/components/landing";
import { ScrollyShowcase } from "@/components/scrolly-showcase";

export default function HomePage() {
  return (
    <>
      <MetaTags />

      <main className="grain dots relative overflow-x-clip bg-landing-soft-bg font-body text-landing-text">
        <ScrollyShowcase />

        <footer className="mx-auto max-w-[60rem] px-[clamp(1rem,4vw,2.5rem)] pb-[clamp(3rem,5vw,4rem)] pt-[clamp(1.5rem,3vw,2rem)] text-center">
          <p className="font-mono text-[0.7rem] leading-[2] text-landing-muted/80">
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
            </a>{" "}
            ·{" "}
            <a
              href="https://github.com/oswaldoacauan/diffgotchi/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="text-landing-muted hover:text-landing-text"
            >
              releases
            </a>
          </p>
        </footer>
      </main>
    </>
  );
}

export async function getConfig() {
  return { render: "static" } as const;
}
