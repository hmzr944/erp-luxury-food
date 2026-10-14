import { FlowMark } from '@/components/brand/FlowLogo'

// Page vue sur le téléphone du client après un paiement par QR code
export function PaymentNotice({ title, text }: { title: string; text: string }) {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-[var(--color-bg-base)] px-6 py-12 text-center text-[var(--color-text-primary)]">
      <FlowMark size={36} />
      <h1 className="text-balance font-display text-4xl font-semibold tracking-[-0.03em]">{title}</h1>
      <p className="max-w-[34ch] text-balance text-lg text-[var(--color-text-secondary)]">{text}</p>
    </main>
  )
}
