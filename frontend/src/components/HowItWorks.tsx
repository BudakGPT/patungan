import { strings } from "@/strings";

const h = strings.discovery.howItWorks;

/**
 * Onboarding "how it works" strip — a quiet, civic QF explainer for cold
 * visitors on `/`. Not a marketing hero: one bordered panel, three *connected* steps split by
 * hairline dividers, with an inline crowd-vs-whale dot metaphor on step 2 (the platform's core
 * intuition — many small donors outweigh one whale, shown in the reserved `match` emerald). Pure
 * static copy from `strings`, so there is no data view and no loading/error/empty state.
 */
export function HowItWorks() {
  return (
    <section
      aria-label={h.overline}
      className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface shadow-card"
    >
      <div className="border-b border-line px-6 py-3.5 sm:px-8">
        <p className="text-xs font-medium uppercase tracking-widest text-accent-ink">
          {h.overline}
        </p>
      </div>
      <ol className="grid grid-cols-1 divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {h.steps.map((s, i) => (
          <li key={s.n} className="flex flex-col gap-3 px-6 py-6 sm:px-8">
            <div className="flex items-baseline gap-2.5">
              <span className="tabular text-sm font-semibold text-faint">{s.n}</span>
              <h3 className="text-base font-semibold text-ink">{s.title}</h3>
            </div>
            <p className="max-w-prose text-sm leading-relaxed text-muted">{s.body}</p>
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
  const v = h.viz;
  return (
    <div className="mt-auto flex items-center gap-3 rounded-xl bg-paper px-3.5 py-3">
      <figure className="flex flex-1 flex-col items-center gap-1.5">
        <div className="flex max-w-[6.5rem] flex-wrap justify-center gap-1" aria-hidden>
          {Array.from({ length: 9 }).map((_, i) => (
            <span
              key={i}
              className="h-2 w-2 rounded-full bg-match motion-safe:animate-dot-in"
              style={{ animationDelay: `${i * 90}ms` }}
            />
          ))}
        </div>
        <figcaption className="text-center text-[0.6875rem] font-medium leading-tight text-match-ink">
          {v.crowd}
        </figcaption>
      </figure>
      <span className="shrink-0 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted">
        {v.beats}
      </span>
      <figure className="flex flex-1 flex-col items-center gap-1.5">
        <span className="h-6 w-6 rounded-full bg-line-strong" aria-hidden />
        <figcaption className="text-center text-[0.6875rem] font-medium leading-tight text-faint">
          {v.whale}
        </figcaption>
      </figure>
      <span className="sr-only">{v.sr}</span>
    </div>
  );
}
