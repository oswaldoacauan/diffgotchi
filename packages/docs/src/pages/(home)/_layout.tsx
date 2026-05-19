import type { ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export async function getConfig() {
  return { render: "static" } as const;
}
