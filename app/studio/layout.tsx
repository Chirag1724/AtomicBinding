import Link from "next/link";
import "../globals.css";
import "./studio.css";

export const metadata = { title: "Imprint Studio" };

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="studio">
      <header className="studio-bar">
        <Link className="wordmark" href="/studio">Imprint Studio</Link>
        <nav>
          <Link href="/studio">Content</Link>
          <Link href="/studio/health">Schema health</Link>
          <Link href="/">View site →</Link>
        </nav>
      </header>
      <main className="studio-body">{children}</main>
    </div>
  );
}
