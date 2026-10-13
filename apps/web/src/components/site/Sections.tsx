import Image from 'next/image'
import Link from 'next/link'
import { Check } from '@phosphor-icons/react/dist/ssr'
import { PLAN_OFFERS, TRIAL_DAYS } from '@erp/types'
import { BRAND } from '@/lib/brand'
import comptoir from '../../../public/site/comptoir.jpg'
import paiement from '../../../public/site/paiement.jpg'
import mode from '../../../public/site/mode.jpg'
import patisserie from '../../../public/site/patisserie.jpg'
import chocolats from '../../../public/site/chocolats.jpg'
import bijoux from '../../../public/site/bijoux.jpg'
import cave from '../../../public/site/cave.jpg'
import fleuriste from '../../../public/site/fleuriste.jpg'

const h2 = 'text-[clamp(2rem,4vw,3.25rem)] font-semibold leading-[1.05] tracking-[-0.03em]'
const lead = 'text-[17px] leading-relaxed text-[var(--color-text-secondary)]'
const primary =
  'inline-flex h-12 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-accent)] px-6 text-[16px] font-semibold text-[var(--color-on-accent)] transition-[background-color,transform] duration-150 hover:bg-[var(--color-accent-hover)] active:scale-[0.97]'
const secondary =
  'inline-flex h-12 items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] px-6 text-[16px] font-semibold transition-[border-color,transform] duration-150 hover:border-[var(--color-text-primary)] active:scale-[0.97]'

export function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-12 md:px-6 md:pt-20 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end lg:gap-12 lg:pb-24">
      <div>
        <h1 className="site-rise text-balance text-[clamp(2.5rem,5.6vw,4.75rem)] font-semibold leading-[1] tracking-[-0.045em]">
          La caisse qu&apos;on sait utiliser dès la première vente.
        </h1>
        <p className={`site-rise mt-6 max-w-xl ${lead}`} style={{ '--delay': '180ms' } as React.CSSProperties}>
          Mode, alimentaire, beauté, cave, fleurs : une caisse sur la tablette ou le téléphone que vous avez déjà, qui continue sans réseau et
          se relie à votre terminal de paiement.
        </p>
        <div className="site-rise mt-8 flex flex-wrap items-center gap-3" style={{ '--delay': '260ms' } as React.CSSProperties}>
          <Link href="/inscription" className={primary}>
            Essayer {TRIAL_DAYS} jours
          </Link>
          <a href="#tarifs" className={secondary}>
            Voir les tarifs
          </a>
        </div>
        <p className="site-rise mt-4 text-[15px] text-[var(--color-text-secondary)]" style={{ '--delay': '300ms' } as React.CSSProperties}>
          Sans carte bancaire, sans engagement, rien à installer.
        </p>
      </div>
      <figure className="site-rise" style={{ '--delay': '140ms' } as React.CSSProperties}>
        <Image
          src={comptoir}
          alt="Deux commerçants souriants derrière le comptoir de leur boutique, une caisse posée sur le bois."
          priority
          placeholder="blur"
          sizes="(min-width: 1152px) 460px, (min-width: 1024px) 40vw, 100vw"
          className="aspect-[4/5] w-full rounded-[var(--radius-xl)] object-cover object-[30%_50%]"
        />
      </figure>
    </section>
  )
}

const CHOICES: Array<{ often: string; here: string }> = [
  { often: 'Engagement de douze mois, résiliation par courrier.', here: "Abonnement mensuel, résiliable depuis l'application." },
  { often: 'Tarif sur devis, installation et formation facturées à part.', here: "Prix affichés ci-dessous. Vous l'installez seul, en quelques minutes." },
  { often: 'Une marque de tablette ou un terminal imposés.', here: 'Tablette, téléphone ou ordinateur : un navigateur récent suffit.' },
  { often: 'Le paiement par carte lié au fournisseur de la caisse.', here: "SumUp ou Stripe reliés, ou votre TPE habituel en autonome. Aucune commission de notre part." },
  { often: 'Internet coupé, caisse arrêtée.', here: "La vente continue hors ligne, ticket signé sur l'appareil, envoi au retour du réseau." },
  { often: 'Remboursements possibles pendant un délai fixé par le logiciel.', here: 'Retour quand vous le décidez : sur la carte, en espèces ou en avoir.' },
  { often: 'Vos ventes et votre catalogue difficiles à récupérer.', here: "Export complet en CSV à tout moment, et import d'un catalogue existant." },
]

export function Choices() {
  return (
    <section aria-labelledby="choix-title" className="mx-auto max-w-6xl px-4 py-20 md:px-6 md:py-28">
      <div className="max-w-2xl">
        <h2 id="choix-title" className={h2}>
          Ce qu&apos;on a refusé de vous imposer.
        </h2>
        <p className={`mt-4 ${lead}`}>
          On a lu les avis des commerçants sur les caisses du marché. Les mêmes reproches reviennent souvent. Chacun a sa réponse ici.
        </p>
      </div>
      <dl className="mt-12 border-t border-[var(--color-border-strong)]">
        {CHOICES.map((c) => (
          <div key={c.here} className="grid gap-1 border-b border-[var(--color-border)] py-5 md:grid-cols-2 md:gap-10">
            <dt className="text-[16px] text-[var(--color-text-secondary)]">{c.often}</dt>
            <dd className="text-[17px] font-medium">{c.here}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function Sectors() {
  return (
    <section aria-labelledby="metiers-title" className="mx-auto max-w-6xl px-4 py-20 md:px-6 md:py-28">
      <div className="max-w-2xl">
        <h2 id="metiers-title" className={h2}>
          Réglée pour votre métier dès l&apos;inscription.
        </h2>
        <p className={`mt-4 ${lead}`}>
          Vous choisissez votre commerce, la caisse prépare la TVA, les moyens de paiement et les fiches produit qui vont avec. Tout reste
          modifiable.
        </p>
      </div>

      <div className="mt-12 grid gap-4 md:grid-cols-6">
        <SectorFigure image={mode} className="md:col-span-4" ratio="aspect-[3/2]" title="Prêt-à-porter, maroquinerie" text="Tailles et couleurs en grille, stock par variante, collection, saison, matière." alt="Portants de vêtements dans une boutique claire, sous des suspensions en métal." />
        <SectorFigure image={patisserie} className="md:col-span-2" ratio="aspect-[3/4] md:aspect-auto md:h-full" title="Pâtisserie, chocolaterie" text="TVA à 5,5 % par défaut, lots et dates limites, origine et conservation." alt="Vitrine de pâtisserie avec des tartes aux fruits rouges et des gâteaux au chocolat." />
        <SectorFigure image={bijoux} className="md:col-span-2" ratio="aspect-[4/3]" title="Bijouterie, horlogerie" text="Numéro de série pièce par pièce, métal, pierres, certificat, garantie." alt="Bagues en or présentées sur des supports dans une vitrine." />
        <SectorFigure image={cave} className="md:col-span-2" ratio="aspect-[4/3]" title="Cave, spiritueux" text="Millésime, appellation et degré sur chaque fiche." alt="Bouteilles de vin couchées sur des étagères en bois." />
        <SectorFigure image={fleuriste} className="md:col-span-2" ratio="aspect-[4/3]" title="Fleurs, concept store" text="Article libre au prix saisi à la main quand rien n'est au catalogue." alt="Boutique de fleuriste remplie de bouquets colorés sous des guirlandes lumineuses." />
      </div>
      <p className="mt-6 max-w-2xl text-[15px] text-[var(--color-text-secondary)]">
        Aussi : beauté et parfumerie, décoration et arts de la table, ateliers et prestations. Un code-barres inconnu se transforme en fiche
        produit en un scan, pré-remplie depuis les bases ouvertes Open Food Facts et Open Beauty Facts.
      </p>
    </section>
  )
}

function SectorFigure({
  image,
  className,
  ratio,
  title,
  text,
  alt,
}: {
  image: typeof mode
  className: string
  ratio: string
  title: string
  text: string
  alt: string
}) {
  return (
    <figure className={`flex flex-col ${className}`}>
      <div className={`relative overflow-hidden rounded-[var(--radius-lg)] ${ratio} min-h-56`}>
        <Image src={image} alt={alt} fill placeholder="blur" sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
      </div>
      <figcaption className="mt-3">
        <span className="block text-[17px] font-semibold">{title}</span>
        <span className="block text-[15px] text-[var(--color-text-secondary)]">{text}</span>
      </figcaption>
    </figure>
  )
}

export function Payment() {
  return (
    <section aria-labelledby="paiement-title" className="bg-[var(--color-text-primary)] text-[var(--color-bg-base)]">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 md:px-6 md:py-28 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-center lg:gap-16">
        <Image
          src={paiement}
          alt="Une main tient un terminal de paiement sans contact affichant 14,80, devant des étagères de produits de soin."
          placeholder="blur"
          sizes="(min-width: 1024px) 440px, 100vw"
          className="aspect-[4/5] w-full rounded-[var(--radius-xl)] object-cover lg:aspect-[3/4]"
        />
        <div>
          <h2 id="paiement-title" className={h2}>
            Le montant part sur le terminal. Personne ne le retape.
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed opacity-80">
            Reliez un lecteur SumUp ou Stripe avec le code affiché à son écran. La caisse envoie le montant, attend la carte et ferme la vente
            seule. Vous gardez votre contrat avec votre prestataire : nous ne prenons rien sur les paiements.
          </p>
          <ul className="mt-8 space-y-4 text-[17px]">
            {[
              ['Un autre TPE ?', "Encaissez dessus comme aujourd'hui, puis touchez Carte : la vente est enregistrée."],
              ['Une note à plusieurs ?', 'Divisez-la en parts égales, chacune réglée avec son propre moyen de paiement.'],
              ['Un retour ?', "La carte est remboursée sur le terminal relié, ou vous rendez un avoir que le client dépense quand il veut."],
            ].map(([q, a]) => (
              <li key={q} className="border-t border-[color-mix(in_srgb,var(--base-bg)_22%,transparent)] pt-4">
                <span className="font-semibold">{q}</span> <span className="opacity-80">{a}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

const START = [
  { title: 'Créez votre compte', text: "Trois questions : votre métier, le nom de votre commerce, votre e-mail. La caisse est prête à l'écran suivant." },
  { title: 'Ajoutez vos produits', text: 'Un nom et un prix suffisent. Ou importez votre catalogue en CSV, ou scannez les codes-barres en caisse au fil des ventes.' },
  { title: 'Ouvrez la caisse sur la tablette', text: "Connectez-vous depuis son navigateur : l'appareil devient une caisse. Ajoutez-la à l'écran d'accueil pour l'ouvrir comme une application." },
  { title: 'Reliez votre TPE, si vous voulez', text: 'Pour essayer sans matériel, un TPE virtuel simule les paiements sur un deuxième écran.' },
]

export function Start() {
  return (
    <section id="demarrer" aria-labelledby="demarrer-title" className="mx-auto max-w-6xl px-4 py-20 md:px-6 md:py-28">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <div>
          <h2 id="demarrer-title" className={h2}>
            Ouvert ce matin, en caisse cet après-midi.
          </h2>
          <p className={`mt-4 max-w-md ${lead}`}>Rien à installer, personne à faire venir. Voici tout le parcours.</p>
          <Link href="/inscription" className={`${primary} mt-8`}>
            Créer mon compte
          </Link>
        </div>
        <ol className="border-t border-[var(--color-border-strong)]">
          {START.map((s, i) => (
            <li key={s.title} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-2 border-b border-[var(--color-border)] py-6">
              <span className="tabular text-xl font-semibold text-[var(--color-accent)]">{i + 1}</span>
              <div>
                <h3 className="text-xl font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-1.5 text-[16px] leading-relaxed text-[var(--color-text-secondary)]">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export function Pricing() {
  return (
    <section id="tarifs" aria-labelledby="tarifs-title" className="bg-[var(--color-bg-surface)]">
      <div className="mx-auto max-w-6xl px-4 py-20 md:px-6 md:py-28">
        <div className="max-w-2xl">
          <h2 id="tarifs-title" className={h2}>
            Un prix par boutique. Le reste est compris.
          </h2>
          <p className={`mt-4 ${lead}`}>
            {TRIAL_DAYS} jours d&apos;essai complet, sans carte bancaire. Ensuite, un abonnement mensuel sans engagement. Caisses et
            utilisateurs illimités, mises à jour comprises.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {PLAN_OFFERS.map((p, i) => (
            <div
              key={p.code}
              className={[
                'flex flex-col rounded-[var(--radius-xl)] p-6 md:p-8',
                i === 0 ? 'border-2 border-[var(--color-accent)]' : 'border border-[var(--color-border-strong)]',
              ].join(' ')}
            >
              <h3 className="text-2xl font-semibold tracking-tight">{p.name}</h3>
              <p className="mt-1 text-[16px] text-[var(--color-text-secondary)]">{p.summary}</p>
              <p className="mt-6 flex items-baseline gap-2">
                <span className="tabular text-5xl font-semibold tracking-tight">{p.monthlyPrice} €</span>
                <span className="text-[15px] text-[var(--color-text-secondary)]">HT par boutique et par mois</span>
              </p>
              <ul className="mt-6 flex-1 space-y-2.5 text-[16px]">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2.5">
                    <Check size={20} aria-hidden className="mt-0.5 shrink-0 text-[var(--color-accent)]" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/inscription" className={`${i === 0 ? primary : secondary} mt-8 w-full`}>
                Essayer {p.name} gratuitement
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-6 max-w-2xl text-[15px] text-[var(--color-text-secondary)]">
          Le paiement par carte se règle chez votre prestataire (SumUp, Stripe ou votre banque), à ses conditions. Le matériel : celui que vous
          avez déjà ; une imprimante de tickets est facultative.
        </p>
      </div>
    </section>
  )
}

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'Que faut-il comme matériel ?',
    a: "Une tablette, un téléphone ou un ordinateur avec un navigateur récent. Un lecteur de codes-barres USB ou Bluetooth fonctionne comme un clavier, sans réglage. L'imprimante de tickets est facultative.",
  },
  {
    q: 'Et si internet coupe en pleine journée ?',
    a: "La caisse continue. Chaque vente est signée sur l'appareil et le ticket est remis au client tout de suite. Les ventes partent au serveur dès le retour du réseau, sans doublon même si l'envoi est répété.",
  },
  {
    q: 'Les tickets sont-ils conformes à la loi anti-fraude à la TVA ?',
    a: "Chaque ticket est signé et chaîné au précédent, sur la caisse puis sur le serveur, et rien ne s'efface : un retour est un ticket négatif, pas une suppression. La certification NF525 par un organisme agréé n'est pas encore obtenue ; nous l'indiquerons ici dès qu'elle le sera.",
  },
  {
    q: 'Puis-je récupérer mes données si je pars ?',
    a: "Oui, à tout moment : ventes, paiements, catalogue, stock et clients s'exportent en CSV depuis les paramètres, lisibles dans Excel ou LibreOffice.",
  },
  {
    q: 'Faut-il une formation ?',
    a: "La caisse est pensée pour s'en passer : une vente simple tient en trois gestes, et chaque écran ne montre que ce qui sert à ce moment-là.",
  },
  {
    q: "Que se passe-t-il à la fin de l'essai ?",
    a: "Vous choisissez une offre depuis Paramètres, Abonnement, et payez par carte. Si vous ne souscrivez pas, rien n'est prélevé et vos données restent exportables.",
  },
]

export function Faq() {
  return (
    <section id="questions" aria-labelledby="questions-title" className="mx-auto max-w-6xl px-4 py-20 md:px-6 md:py-28">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <h2 id="questions-title" className={h2}>
          Questions avant de commencer.
        </h2>
        <div className="border-t border-[var(--color-border-strong)]">
          {FAQ.map((f) => (
            <details key={f.q} className="group border-b border-[var(--color-border)]">
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 text-[18px] font-semibold [&::-webkit-details-marker]:hidden">
                {f.q}
                <span aria-hidden className="relative size-4 shrink-0">
                  <span className="absolute left-0 top-1/2 h-0.5 w-4 -translate-y-1/2 bg-current" />
                  <span className="absolute left-1/2 top-0 h-4 w-0.5 -translate-x-1/2 bg-current transition-transform duration-200 group-open:scale-y-0" />
                </span>
              </summary>
              <p className="max-w-[62ch] pb-5 text-[16px] leading-relaxed text-[var(--color-text-secondary)]">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

export function FinalCall() {
  return (
    <section aria-labelledby="fin-title" className="mx-auto max-w-6xl px-4 pb-20 md:px-6 md:pb-28">
      <div className="relative overflow-hidden rounded-[var(--radius-xl)] bg-[var(--color-accent)] px-6 py-14 text-[var(--color-on-accent)] md:px-12 md:py-20">
        <Image src={chocolats} alt="" fill placeholder="blur" sizes="100vw" className="object-cover opacity-20 mix-blend-luminosity" />
        <div className="relative max-w-2xl">
          <h2 id="fin-title" className={h2}>
            Faites votre prochaine vente avec {BRAND}.
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed opacity-90">
            {TRIAL_DAYS} jours pour l&apos;essayer en boutique, avec vos produits et vos clients.
          </p>
          <Link
            href="/inscription"
            className="mt-8 inline-flex h-12 items-center rounded-[var(--radius-pill)] bg-[var(--color-on-accent)] px-6 text-[16px] font-semibold text-[var(--color-accent)] transition-transform duration-150 active:scale-[0.97]"
          >
            Créer mon compte
          </Link>
        </div>
      </div>
    </section>
  )
}

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--color-border)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 text-[14px] text-[var(--color-text-secondary)] md:flex-row md:justify-between md:px-6">
        <p>
          {BRAND}, caisse et gestion pour les commerces.{' '}
          <Link href="/login" className="underline underline-offset-4 hover:text-[var(--color-text-primary)]">
            Se connecter
          </Link>
        </p>
        <p className="max-w-xl">
          Photos Unsplash : Vitaly Gariev, SumUp, Clark Street Mercantile, Ulysse Pointcheval, Zayed Ahmed Zadu, Benjamin DeYoung, Ana Maltez,
          Marquise de Photographie. Captures : la caisse {BRAND}.
        </p>
      </div>
    </footer>
  )
}
