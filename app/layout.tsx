import type { Metadata } from "next";
import Link from "next/link";
import { openStore } from "@imprint/store";
import "./globals.css";

export const metadata: Metadata = {
  title: "Imprint",
  description: "A dual-source content platform: docs in git, everything else in a CMS.",
};

interface NavItem { label: string; target: { label: string; href: string } }

/** Singletons have no route; they are fetched by type. */
function singleton<T>(type: string): T | null {
  try {
    const rows = openStore().all("published", type);
    return (rows[0]?.data as T) ?? null;
  } catch {
    // The store being down must degrade the chrome, not blank the site.
    return null;
  }
}

const FALLBACK: NavItem[] = [
  { label: "Docs", target: { label: "Docs", href: "/docs" } },
  { label: "Blog", target: { label: "Blog", href: "/blog" } },
  { label: "Integrations", target: { label: "Integrations", href: "/integrations" } },
  { label: "Changelog", target: { label: "Changelog", href: "/changelog" } },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const nav = singleton<{ items: NavItem[] }>("navigation");
  const settings = singleton<{ siteName: string; tagline?: string; footerNote?: string }>("siteSettings");
  const items = nav?.items?.length ? nav.items : FALLBACK;

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
        />
      </head>
      <body>
        <div className="shell">
          <header className="topbar">
            <Link className="wordmark" href="/">{settings?.siteName ?? "Imprint"}</Link>
            <nav>
              {items.map((item) => (
                <Link key={item.target.href} href={item.target.href}>{item.label}</Link>
              ))}
            </nav>
            <span className="spacer" />
            <nav><Link href="/studio">Studio →</Link></nav>
          </header>

          {children}

          <footer className="sitefoot">
            {settings?.footerNote ?? "Docs live in git. Everything else lives in the CMS. One graph over both."}
          </footer>
        </div>
      </body>
    </html>
  );
}
