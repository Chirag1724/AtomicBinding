// Every route that is not the home page. Docs, blog, marketing, integrations, changelog
// — all of them, from one file, because the graph does not distinguish them.

import { RoutePage } from "@/render/RoutePage";

// Marketing routes are server-rendered so a CMS publish appears without a deploy.
export const dynamic = "force-dynamic";

export default async function CatchAll({
  params,
  searchParams,
}: {
  params: Promise<{ route: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { route } = await params;
  const query = await searchParams;
  return <RoutePage path={`/${route.join("/")}`} preview={query.preview === "1"} />;
}
