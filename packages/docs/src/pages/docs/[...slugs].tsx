import { source } from "@/lib/source";
import { DocsPage, DocsBody } from "fumadocs-ui/page";
import { getMDXComponents } from "@/components/mdx";
import { unstable_notFound } from "waku/router/server";

interface PageProps {
  slugs: string[];
}

export default async function Page({ slugs }: PageProps) {
  const page = source.getPage(slugs);
  if (!page) unstable_notFound();

  const MDX = page.data.body;

  return (
    <DocsPage toc={page.data.toc}>
      <DocsBody>
        <h1>{page.data.title}</h1>
        <MDX components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}

export async function getConfig() {
  const pages = source.generateParams().map((item) => item.slug);
  return { render: "static" as const, staticPaths: pages } as const;
}
