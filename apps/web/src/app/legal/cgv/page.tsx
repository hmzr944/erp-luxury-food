import type { Metadata } from 'next'
import Link from 'next/link'
import { PLAN_OFFERS, TRIAL_DAYS } from '@erp/types'
import { BRAND } from '@/lib/brand'
import { EDITOR } from '@/lib/legal'
import { LegalDoc, Mail, Review, V, type LegalSection } from '../_ui'

export const metadata: Metadata = {
  title: 'Conditions générales de vente',
  description: `Abonnement professionnel à ${BRAND} : offres et prix HT, essai de ${TRIAL_DAYS} jours, paiement, retard, résiliation et données.`,
}

const euros = (n: number) => `${n.toLocaleString('fr-FR')} €`

const sections: LegalSection[] = [
  {
    id: 'champ',
    title: "Champ d'application",
    review: true,
    body: (
      <>
        <p>
          Ces conditions générales de vente s&apos;appliquent à l&apos;abonnement au logiciel {BRAND}, vendu par <V value={EDITOR.company} /> à
          des professionnels (commerçants, artisans, sociétés) pour les besoins de leur activité. Elles ne s&apos;adressent pas aux
          consommateurs.
        </p>
        <p>
          Elles sont communiquées à tout professionnel qui en fait la demande, conformément à l&apos;article L441-1 du code de commerce, et sont
          acceptées lors de la souscription. L&apos;usage du service est régi par les{' '}
          <Link href="/legal/cgu">conditions générales d&apos;utilisation</Link>.
        </p>
      </>
    ),
  },
  {
    id: 'offres',
    title: 'Offres et prix',
    body: (
      <>
        <p>Deux offres, sans engagement. Les prix sont exprimés hors taxes, par boutique et par mois :</p>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full border-collapse text-left text-[16px]">
            <caption className="sr-only">Offres {BRAND} et prix mensuels hors taxes</caption>
            <thead>
              <tr className="border-b border-[var(--color-border-strong)] text-[14px] text-[var(--color-text-secondary)]">
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Offre
                </th>
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Pour qui
                </th>
                <th scope="col" className="whitespace-nowrap py-2 text-right font-semibold">
                  Prix HT
                </th>
              </tr>
            </thead>
            <tbody>
              {PLAN_OFFERS.map((p) => (
                <tr key={p.code} className="border-b border-[var(--color-border)] align-top">
                  <th scope="row" className="whitespace-nowrap py-3 pr-4 font-display text-[18px] font-bold">
                    {p.name}
                  </th>
                  <td className="py-3 pr-4 text-[var(--color-text-secondary)]">{p.summary}</td>
                  <td className="tabular whitespace-nowrap py-3 text-right font-semibold">
                    {euros(p.monthlyPrice)}
                    <span className="block whitespace-normal text-[13px] font-normal text-[var(--color-text-secondary)]">par boutique et par mois</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Le contenu de chaque offre est présenté sur la <Link href="/#tarifs">page des tarifs</Link>. Caisses et utilisateurs sont illimités, les
          mises à jour comprises. Le montant mensuel est le prix de l&apos;offre multiplié par le nombre de boutiques du compte, avec un minimum
          d&apos;une boutique.
        </p>
        <p>
          {EDITOR.vatFranchise
            ? 'TVA non applicable, article 293 B du code général des impôts.'
            : 'La TVA au taux en vigueur s’ajoute aux prix hors taxes.'}{' '}
          Aucune remise, ristourne ni escompte pour paiement anticipé n&apos;est accordé, sauf accord écrit.
        </p>
        <p>
          Les paiements par carte des clients du commerce sont réglés au prestataire choisi par le commerçant, à ses conditions : {BRAND} ne prend
          aucune commission sur ces paiements. Le matériel n&apos;est pas vendu par {BRAND}.
        </p>
      </>
    ),
  },
  {
    id: 'essai',
    title: 'Essai gratuit',
    review: true,
    body: (
      <p>
        Chaque nouveau compte bénéficie d&apos;un essai complet de {TRIAL_DAYS} jours, sans carte bancaire. Rien n&apos;est prélevé si le
        commerçant ne souscrit pas à la fin de l&apos;essai, et ses données restent exportables.
      </p>
    ),
  },
  {
    id: 'souscription',
    title: 'Souscription',
    body: (
      <p>
        Le titulaire du compte souscrit depuis l&apos;application (Paramètres, Abonnement) en choisissant une offre. Le paiement est réalisé sur la
        page sécurisée de notre prestataire Stripe ; {BRAND} ne reçoit ni ne conserve les numéros de carte. Le contrat prend effet à la
        confirmation du paiement.
      </p>
    ),
  },
  {
    id: 'paiement',
    title: 'Facturation et conditions de règlement',
    review: true,
    body: (
      <>
        <p>
          L&apos;abonnement est payable d&apos;avance, par carte bancaire, à la souscription puis à chaque échéance mensuelle, par prélèvement
          automatique sur la carte enregistrée. Une facture est émise à chaque échéance.
        </p>
        <p>
          Le titulaire du compte met à jour sa carte depuis Paramètres, Abonnement. Si un prélèvement échoue, il en est informé et doit régulariser
          sans délai.
        </p>
      </>
    ),
  },
  {
    id: 'retard',
    title: 'Retard de paiement',
    body: (
      <>
        <p>Toute somme non payée à l&apos;échéance entraîne, de plein droit et sans rappel :</p>
        <ul>
          <li>
            des pénalités de retard calculées au taux d&apos;intérêt appliqué par la Banque centrale européenne à son opération de refinancement
            la plus récente, majoré de 10 points (article L441-10 du code de commerce), dues à compter du jour suivant la date de règlement ;
          </li>
          <li>
            une indemnité forfaitaire pour frais de recouvrement de 40 € par facture (articles L441-10 et D441-5 du code de commerce). Si les frais
            réellement engagés sont supérieurs, une indemnisation complémentaire peut être demandée sur justificatifs.
          </li>
        </ul>
        <p>
          Après un retard de paiement non régularisé, l&apos;éditeur peut limiter l&apos;accès au service après en avoir informé le titulaire du
          compte. L&apos;encaissement et l&apos;accès aux exports et archives fiscales restent possibles. <Review />
        </p>
      </>
    ),
  },
  {
    id: 'resiliation',
    title: 'Durée et résiliation',
    review: true,
    body: (
      <>
        <p>
          L&apos;abonnement est mensuel, sans engagement, et se renouvelle chaque mois. Le titulaire du compte le résilie à tout moment depuis
          Paramètres, Abonnement. La résiliation prend effet à la fin du mois déjà payé ; le mois commencé n&apos;est pas remboursé.
        </p>
        <p>
          En cas de manquement grave du commerçant (usage frauduleux, impayé persistant), l&apos;éditeur peut résilier l&apos;abonnement après une
          mise en demeure restée sans effet pendant <V value={null} />.
        </p>
      </>
    ),
  },
  {
    id: 'donnees',
    title: 'Données après la résiliation',
    review: true,
    body: (
      <>
        <p>
          Avant et après la résiliation, le commerçant peut exporter ses ventes, paiements, catalogue, stock, clients, clôtures et archives
          fiscales signées. Nous lui recommandons de le faire avant la fin de l&apos;abonnement.
        </p>
        <p>
          Les données restent accessibles en lecture et en export pendant <V value={null} /> après la fin de l&apos;abonnement, puis sont
          supprimées. Le commerçant reste tenu de conserver ses documents fiscaux pendant six ans (article L102 B du livre des procédures fiscales).
        </p>
      </>
    ),
  },
  {
    id: 'prix',
    title: 'Évolution des prix et des conditions',
    review: true,
    body: (
      <p>
        Toute hausse de prix ou modification de ces conditions est annoncée au titulaire du compte au moins <V value={null} /> avant son
        application. Il peut résilier avant cette date s&apos;il ne l&apos;accepte pas.
      </p>
    ),
  },
  {
    id: 'responsabilite',
    title: 'Responsabilité',
    review: true,
    body: (
      <p>
        La responsabilité de l&apos;éditeur, toutes causes confondues, est limitée aux dommages directs et prouvés, dans la limite des sommes
        payées par le commerçant au titre des douze derniers mois d&apos;abonnement. Cette limite ne s&apos;applique pas en cas de faute lourde ou
        dolosive.
      </p>
    ),
  },
  {
    id: 'litiges',
    title: 'Droit applicable et litiges',
    review: true,
    body: (
      <>
        <p>
          Ces conditions sont soumises au droit français. En cas de différend, les parties cherchent d&apos;abord une solution amiable en écrivant à{' '}
          <Mail value={EDITOR.email} />.
        </p>
        <p>
          À défaut d&apos;accord, le litige est porté devant : <V value={EDITOR.court} />.
        </p>
      </>
    ),
  },
]

export default function CgvPage() {
  return (
    <LegalDoc
      slug="cgv"
      title="Conditions générales de vente"
      intro={
        <p>
          L&apos;abonnement à {BRAND} pour les professionnels : ce qu&apos;il coûte, comment il se paie, comment il s&apos;arrête, et ce que
          deviennent vos données.
        </p>
      }
      sections={sections}
    />
  )
}
