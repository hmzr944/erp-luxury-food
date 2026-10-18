import Link from 'next/link'
import type { ReactNode } from 'react'
import { LEGAL_DRAFT, LEGAL_PAGES, LEGAL_VERSION, LEGAL_VERSION_DATE, TO_COMPLETE, formatLegalDate, type LegalSlug } from '@/lib/legal'

// Valeur manquante : bien visible, jamais remplacée par une valeur inventée
export function Missing() {
  return (
    <mark className="whitespace-nowrap rounded-[var(--radius-sm)] border border-dashed border-[var(--color-accent)] bg-[var(--color-accent-muted)] px-1 font-semibold text-[var(--color-text-primary)]">
      {TO_COMPLETE}
    </mark>
  )
}

export function V({ value }: { value?: string | null }) {
  return value ? <>{value}</> : <Missing />
}

export function Mail({ value }: { value?: string }) {
  if (!value) return <Missing />
  return <a href={`mailto:${value}`}>{value}</a>
}

// Clause à faire relire par un juriste : repère affiché tant que les textes sont en brouillon
export function Review() {
  if (!LEGAL_DRAFT) return null
  return (
    <span className="ml-2 inline-flex translate-y-[-0.2em] items-center rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] px-2 py-0.5 align-middle font-body text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-secondary)]">
      À valider
    </span>
  )
}

export interface LegalSection {
  id: string
  title: string
  review?: boolean
  body: ReactNode
}

const prose = [
  'text-[17px] leading-[1.7] text-[var(--color-text-primary)] [overflow-wrap:anywhere]',
  '[&_p]:mt-4 [&_p:first-child]:mt-0',
  '[&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5',
  '[&_li]:pl-1 [&_li::marker]:text-[var(--color-text-muted)]',
  '[&_h3]:mt-8 [&_h3]:font-display [&_h3]:text-[19px] [&_h3]:font-bold [&_h3]:tracking-[-0.01em]',
  '[&_a]:underline [&_a]:decoration-[var(--color-border-strong)] [&_a]:underline-offset-4 hover:[&_a]:decoration-[var(--color-accent)]',
  '[&_strong]:font-semibold [&_dt]:font-semibold [&_dd]:mb-3 [&_dd]:text-[var(--color-text-secondary)]',
].join(' ')

export function LegalDoc({ slug, title, intro, sections }: { slug: LegalSlug; title: string; intro: ReactNode; sections: LegalSection[] }) {
  const version = formatLegalDate(LEGAL_VERSION_DATE)
  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-10 md:px-6 md:pt-16">
      <nav aria-label="Documents légaux" className="-mx-1 flex flex-wrap gap-2">
        {LEGAL_PAGES.map((p) => (
          <Link
            key={p.slug}
            href={p.href}
            aria-current={p.slug === slug ? 'page' : undefined}
            className="rounded-[var(--radius-pill)] border border-[var(--color-border)] px-3 py-1.5 text-[14px] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)] aria-[current=page]:border-[var(--color-text-primary)] aria-[current=page]:font-semibold aria-[current=page]:text-[var(--color-text-primary)]"
          >
            {p.label}
          </Link>
        ))}
      </nav>

      <header className="mt-10 max-w-[70ch]">
        <h1 className="text-balance font-display text-[clamp(2.2rem,4.6vw,3.6rem)] font-bold leading-[1.02] tracking-[-0.04em]">{title}</h1>
        <p className="mt-4 text-[15px] text-[var(--color-text-secondary)]">
          Version du <time dateTime={LEGAL_VERSION_DATE}>{version}</time> (référence {LEGAL_VERSION})
        </p>
        {LEGAL_DRAFT && (
          <p role="note" className="mt-6 rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] p-4 text-[15px] leading-relaxed">
            <strong className="font-semibold">Projet en cours de relecture.</strong> Ce texte n&apos;a pas encore été validé par un juriste. Les clauses
            marquées « À valider » et les valeurs « {TO_COMPLETE} » seront arrêtées avant la mise en service commerciale.
          </p>
        )}
        <div className="mt-6 text-[17px] leading-[1.7] text-[var(--color-text-secondary)] [&_p]:mt-3 [&_p:first-child]:mt-0">{intro}</div>
      </header>

      <div className="mt-12 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-16">
        <nav aria-labelledby="sommaire-titre" className="lg:sticky lg:top-8 lg:self-start">
          <h2 id="sommaire-titre" className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
            Sommaire
          </h2>
          <ol className="mt-3 space-y-0.5 border-l border-[var(--color-border)] text-[15px]">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="-ml-px flex gap-2 border-l border-transparent py-1.5 pl-4 text-[var(--color-text-secondary)] hover:border-[var(--color-text-primary)] hover:text-[var(--color-text-primary)]"
                >
                  <span className="tabular text-[var(--color-text-muted)]">{i + 1}.</span>
                  <span>{s.title}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0 max-w-[70ch]">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-titre`} className="scroll-mt-8 border-t border-[var(--color-border)] pb-4 pt-8 first:border-t-0 first:pt-0">
              <h2 id={`${s.id}-titre`} className="text-balance font-display text-[clamp(1.4rem,2.4vw,1.75rem)] font-bold leading-tight tracking-[-0.02em]">
                <span className="tabular mr-2 text-[var(--color-text-muted)]">{i + 1}.</span>
                {s.title}
                {s.review && <Review />}
              </h2>
              <div className={`mt-4 ${prose}`}>{s.body}</div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
