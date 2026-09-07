// `/` is not a special route. Site settings name a marketing page, and that page's own
// route is rendered here — so the home page is an ordinary document that can be swapped,
// previewed and unpublished like any other.

import Link from "next/link";
import { openStore } from "@imprint/store";
import { RoutePage } from "@/render/RoutePage";

export const dynamic = "force-dynamic";

function homeRoute(): string | null {
  try {
    const store = openStore();
    const settings = store.all("published", "siteSettings")[0];
    const ref = settings?.data.homePage as { _ref?: string } | undefined;
    if (!ref?._ref) return null;
    return store.get(ref._ref, "published")?.route ?? null;
  } catch {
    return null;
  }
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const route = homeRoute();

  if (!route) {
    return (
      <main>
        <h1>Nothing is published yet</h1>
        <p>
          Run <code>npm run seed</code> to create the content, or open the{" "}
          <Link href="/studio">studio</Link> and publish a marketing page, then point
          Site settings at it.
        </p>
        <p>
          The git-owned side needs no setup — <Link href="/docs">the docs</Link> are
          already there, because they are files.
        </p>
      </main>
    );
  }

  return <RoutePage path={route} preview={query.preview === "1"} />;
}
