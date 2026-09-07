// The block components.
//
// Each one types its props from the SAME definition the studio renders a form for and
// the store validates against. There is no second declaration of a field here.

import Link from "next/link";
import type { BlockInstance, LinkValue, Props } from "@imprint/schema";
import type {
  callout, codeBlock, ctaSection, faq, featureGrid, hero, logoWall, richTextBlock,
  integrationGrid,
} from "~/schema";
import { RichText } from "./RichText";

type Card = Record<string, unknown>;

const text = (value: unknown): string => (typeof value === "string" ? value : "");

function Action({ link, tone }: { link: LinkValue | undefined; tone: "primary" | "secondary" }) {
  if (!link?.href) return null;
  const className = tone === "primary" ? "btn btn-primary" : "btn";
  return link.href.startsWith("/")
    ? <Link className={className} href={link.href}>{link.label}</Link>
    : <a className={className} href={link.href} rel="noreferrer">{link.label}</a>;
}

export function Hero(props: Props<typeof hero>) {
  return (
    <section className={`block hero ${props.align === "centre" ? "hero-centre" : ""}`}>
      <div>
        <h1>{props.heading}</h1>
        {props.subheading ? <p className="lede">{props.subheading}</p> : null}
        {props.primaryAction || props.secondaryAction ? (
          <div className="actions">
            <Action link={props.primaryAction} tone="primary" />
            <Action link={props.secondaryAction} tone="secondary" />
          </div>
        ) : null}
      </div>
      {props.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="hero-image" src={props.image.absolutePath} alt={props.image.alt} />
      ) : null}
    </section>
  );
}

export function RichTextBlock(props: Props<typeof richTextBlock>) {
  return <section className="block"><RichText doc={props.body} /></section>;
}

export function Callout(props: Props<typeof callout>) {
  return (
    <aside className={`block callout callout-${props.tone ?? "note"}`}>
      <p className="callout-tag">{props.title ?? props.tone ?? "note"}</p>
      <RichText doc={props.body} />
    </aside>
  );
}

export function CodeBlock(props: Props<typeof codeBlock>) {
  return (
    <figure className="block code">
      <figcaption>{props.filename ?? props.language}</figcaption>
      <pre><code>{props.code}</code></pre>
    </figure>
  );
}

export function FeatureGrid(props: Props<typeof featureGrid>) {
  return (
    <section className="block">
      {props.heading ? <h2>{props.heading}</h2> : null}
      <div className="grid" data-columns={props.columns ?? "3"}>
        {(props.features ?? []).map((feature, index) => (
          <article className="card" key={`${feature.title}-${index}`}>
            <h3>{feature.title}</h3>
            <p>{feature.body}</p>
            {feature.href ? <Action link={feature.href} tone="secondary" /> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

export function Faq(props: Props<typeof faq>) {
  return (
    <section className="block">
      <h2>{props.heading ?? "Frequently asked"}</h2>
      <dl className="faq">
        {(props.items ?? []).map((item, index) => (
          <div key={`${item.question}-${index}`}>
            <dt>{item.question}</dt>
            <dd><RichText doc={item.answer} /></dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function CtaSection(props: Props<typeof ctaSection>) {
  return (
    <section className={`block cta cta-${props.tone ?? "quiet"}`}>
      <div>
        <h2>{props.heading}</h2>
        {props.body ? <p>{props.body}</p> : null}
      </div>
      <Action link={props.action} tone="primary" />
    </section>
  );
}

export function LogoWall(props: Props<typeof logoWall>) {
  return (
    <section className="block">
      {props.heading ? <h2>{props.heading}</h2> : null}
      <div className="logos">
        {(props.logos ?? []).map((logo, index) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={`${logo.name}-${index}`} src={logo.image.absolutePath} alt={logo.image.alt || logo.name} />
        ))}
      </div>
    </section>
  );
}

/**
 * The bound block. It holds no card content of its own — `items` arrives from the
 * binding resolver, which read the feed the schema declared.
 */
export function IntegrationGrid(props: Props<typeof integrationGrid> & { items?: Card[] }) {
  const items = props.max ? (props.items ?? []).slice(0, props.max) : props.items ?? [];

  if (items.length === 0) {
    return (
      <section className="block">
        <h2>{props.heading ?? "Integrations"}</h2>
        <p className="empty">No binding, so no cards. Bind this block to a feed in the studio.</p>
      </section>
    );
  }

  return (
    <section className="block">
      <h2>{props.heading ?? "Integrations"}</h2>
      <div className="grid" data-columns={props.columns ?? "3"}>
        {items.map((card, index) => (
          <Link className="card card-link" key={`${text(card.href)}-${index}`} href={text(card.href) || "#"}>
            {card.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="card-logo" src={text(card.image)} alt="" />
            ) : null}
            <h3>{text(card.title)}</h3>
            <p>{text(card.summary)}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

/**
 * name -> component. The one dispatch table in the system.
 *
 * Prop types are enforced per-block, where each component declares
 * `Props<typeof thatBlock>`. They are deliberately NOT enforced at this boundary: a
 * block instance arrives as stored JSON, so the check that matters already happened in
 * the validator and the gates.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const COMPONENTS: Record<string, React.ComponentType<any>> = {
  hero: Hero,
  richTextBlock: RichTextBlock,
  callout: Callout,
  codeBlock: CodeBlock,
  featureGrid: FeatureGrid,
  faq: Faq,
  ctaSection: CtaSection,
  logoWall: LogoWall,
  integrationGrid: IntegrationGrid,
};

export function componentFor(instance: BlockInstance) {
  return COMPONENTS[instance._type] ?? null;
}
