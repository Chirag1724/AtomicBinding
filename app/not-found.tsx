import Link from "next/link";

export default function NotFound() {
  return (
    <main>
      <h1>Nothing answers to that route</h1>
      <p>
        Every route on this site is claimed by exactly one source, and none of them claims
        this one. If a page used to be here, its route moved — which is the case the link
        integrity gate exists to catch before it ships.
      </p>
      <p><Link href="/">Back to the home page</Link></p>
    </main>
  );
}
