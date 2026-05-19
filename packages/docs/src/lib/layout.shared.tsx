import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export const baseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <span className="inline-flex items-center gap-2 font-kawaii text-xl">
        <img src="/favicon-32.png" alt="" width={24} height={24} className="size-6" />
        Diffgotchi
      </span>
    ),
  },
  themeSwitch: { enabled: false },
  githubUrl: "https://github.com/oswaldoacauan/diffgotchi",
  links: [
    {
      text: "Docs",
      url: "/docs",
    },
  ],
};
