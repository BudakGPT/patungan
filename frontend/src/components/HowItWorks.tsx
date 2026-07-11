"use client";

import { useStrings } from "@/lib/locale";

/**
 * Onboarding "how it works" strip — the QF explainer for cold visitors on `/`, set directly on
 * the cream body as a ruled ledger row (no floating card): oversized step numerals, hairline
 * dividers, and the crowd-vs-whale dot metaphor inline on step 2 in the reserved `match`
 * emerald. Pure static copy from `strings`, so there is no data view and no loading/error state.
 */
export function HowItWorks() {
  const strings = useStrings();
  const h = strings.discovery.howItWorks;
  return (
    <section aria-label={h.overline} className="mt-14 border-t-2 border-ink pt-8">
      <p className="mono text-[11px] font-bold uppercase tracking-[.14em] text-ink/55">
        {`// ${h.overline}`}
      </p>
      <ol className="mt-6 grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-8">
        {h.steps.map((s, i) => (
          <li key={s.n} className="flex flex-col">
            <span className="display text-5xl leading-none text-ink/15 sm:text-6xl" aria-hidden>
              {s.n}
            </span>
            <h3 className="mt-4 text-lg font-black leading-tight text-ink">{s.title}</h3>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink/70">{s.body}</p>
            {i === 1 ? <CrowdVsWhale /> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * The QF intuition, drawn: nine small emerald `match` dots (the crowd) visibly outweigh one large
 * muted dot (the whale). Decorative, so the whole comparison is exposed to assistive tech as one
 * sentence and the dots themselves are `aria-hidden`.
 */
function CrowdVsWhale() {
  const strings = useStrings();
  const v = strings.discovery.howItWorks.viz;
  return (
    <div className="mt-4 flex items-center gap-4 border-t border-ink/10 pt-4">
      <figure className="flex flex-col items-start gap-1.5">
        <div className="flex max-w-[6.5rem] flex-wrap gap-1" aria-hidden>
          {Array.from({ length: 9 }).map((_, i) => (
            <span
              key={i}
              className="h-2.5 w-2.5 rounded-full bg-match motion-safe:animate-dot-in"
              style={{ animationDelay: `${i * 90}ms` }}
            />
          ))}
        </div>
        <figcaption className="text-[0.6875rem] font-bold leading-tight text-match-ink">
          {v.crowd}
        </figcaption>
      </figure>
      <span className="shrink-0 text-[0.6875rem] font-black uppercase tracking-wide text-ink/55">
        {v.beats}
      </span>
      <figure className="flex flex-col items-start gap-1.5">
        <span className="h-7 w-7 rounded-full bg-ink/15" aria-hidden />
        <figcaption className="text-[0.6875rem] font-bold leading-tight text-ink/55">
          {v.whale}
        </figcaption>
      </figure>
      <span className="sr-only">{v.sr}</span>
    </div>
  );
}
