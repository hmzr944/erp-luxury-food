import type { Metadata } from 'next'
import Link from 'next/link'
import { BRAND } from '@/lib/brand'
import { EDITOR, HOST } from '@/lib/legal'
import { LegalDoc, Mail, V, type LegalSection } from '../_ui'

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation",
  description: `Règles d'usage du logiciel de caisse ${BRAND} : compte, conformité fiscale, fonctionnement hors ligne, données et responsabilités.`,
}

const sections: LegalSection[] = [
  {
    id: 'objet',
    title: 'Objet et acceptation',
    body: (
      <>
        <p>
          Ces conditions fixent les règles d&apos;usage du logiciel de caisse et de gestion {BRAND}, édité par <V value={EDITOR.company} /> (voir
          les <Link href="/legal/mentions-legales">mentions légales</Link>). Elles s&apos;appliquent à toute personne qui utilise le service au nom
          d&apos;un commerce : le titulaire du compte et les membres de son équipe.
        </p>
        <p>
          Le service est réservé aux professionnels. Les conditions sont acceptées à l&apos;inscription ; la date et la version acceptées sont
          enregistrées. L&apos;abonnement payant est régi par les <Link href="/legal/cgv">conditions générales de vente</Link>.
        </p>
      </>
    ),
  },
  {
    id: 'service',
    title: 'Le service',
    body: (
      <>
        <p>{BRAND} est un logiciel en ligne, utilisé depuis un navigateur sur tablette, téléphone ou ordinateur. Il permet notamment :</p>
        <ul>
          <li>d&apos;encaisser et d&apos;éditer des tickets signés, y compris sans connexion internet ;</li>
          <li>de gérer retours, échanges, avoirs, catalogue, stock et clients ;</li>
          <li>de relier un terminal de paiement (SumUp, Stripe) ou d&apos;utiliser son terminal habituel en autonome ;</li>
          <li>de tenir les clôtures et archives fiscales et d&apos;exporter ses données.</li>
        </ul>
        <p>
          Le contenu exact dépend de l&apos;offre choisie, décrite dans les <Link href="/legal/cgv#offres">conditions générales de vente</Link>.
          L&apos;agent local {BRAND}-Bridge, facultatif, relie la caisse à une imprimante, un tiroir ou un terminal de la boutique.
        </p>
      </>
    ),
  },
  {
    id: 'compte',
    title: 'Compte et accès',
    body: (
      <>
        <p>
          Le titulaire du compte crée l&apos;espace du commerce, invite son équipe et attribue les rôles. Lui seul souscrit et résilie
          l&apos;abonnement.
        </p>
        <p>
          Chaque utilisateur se connecte avec ses propres identifiants. En caisse, un vendeur peut s&apos;identifier par un code à quatre chiffres
          ou un badge (QR code ou NFC). Identifiants, codes et badges sont personnels : le commerçant veille à ce qu&apos;ils ne soient pas
          partagés et signale sans délai toute perte ou tout usage suspect.
        </p>
      </>
    ),
  },
  {
    id: 'obligations',
    title: 'Engagements du commerçant',
    body: (
      <ul>
        <li>utiliser le service pour son activité professionnelle, dans le respect de la loi ;</li>
        <li>saisir des informations exactes (identité du commerce, taux de TVA, prix, moyens de paiement) ;</li>
        <li>disposer d&apos;un matériel et d&apos;une connexion adaptés, et maintenir ses appareils à jour ;</li>
        <li>
          informer ses propres clients du traitement de leurs données (fichier fidélité, reçus par e-mail), dont il est responsable : voir la{' '}
          <Link href="/legal/confidentialite#clients-finaux">politique de confidentialité</Link> ;
        </li>
        <li>ne pas tenter de contourner la sécurité du service, ni d&apos;en perturber le fonctionnement.</li>
      </ul>
    ),
  },
  {
    id: 'fiscal',
    title: 'Conformité fiscale de la caisse',
    review: true,
    body: (
      <>
        <p>
          {BRAND} tient les conditions d&apos;inaltérabilité, de sécurisation, de conservation et d&apos;archivage prévues au 3° bis du I de
          l&apos;article 286 du code général des impôts : chaque ticket est signé et chaîné au précédent, un retour est un ticket négatif et non une
          suppression, et les clôtures journalières, mensuelles et annuelles sont tenues automatiquement.
        </p>
        <h3>Attestation individuelle</h3>
        <p>
          L&apos;éditeur délivre depuis l&apos;application une attestation individuelle selon le modèle de l&apos;administration fiscale
          (BOI-LETTRE-000242). Le volet 1 est rempli par l&apos;éditeur. <strong>Le volet 2 doit être complété et signé par le commerçant</strong> :
          sans lui, l&apos;attestation n&apos;a pas de valeur. Les deux volets sont à présenter en cas de contrôle.
        </p>
        <p>
          {BRAND} n&apos;est pas certifié par un organisme accrédité. Si une certification est obtenue, elle sera indiquée sur le site.
        </p>
        <h3>Archives</h3>
        <p>
          À chaque clôture de mois et d&apos;année, une archive scellée et signée est créée, lisible sans {BRAND}. Le commerçant reste tenu de
          conserver ses documents fiscaux pendant la durée légale (six ans selon l&apos;article L102 B du livre des procédures fiscales) : nous lui
          recommandons de télécharger ces archives et d&apos;en garder une copie sur un support externe.
        </p>
      </>
    ),
  },
  {
    id: 'hors-ligne',
    title: 'Fonctionnement hors ligne',
    review: true,
    body: (
      <>
        <p>
          Sans réseau, la caisse continue : la vente est signée et conservée sur l&apos;appareil, le ticket est remis au client, puis la vente est
          envoyée au serveur dès le retour de la connexion, sans doublon.
        </p>
        <p>
          Tant qu&apos;une vente n&apos;a pas été envoyée, elle n&apos;existe que sur l&apos;appareil. Le commerçant ne doit pas effacer les données
          du navigateur ni réinitialiser l&apos;appareil avant que la caisse indique que tout est envoyé.
        </p>
      </>
    ),
  },
  {
    id: 'paiements',
    title: 'Paiements par carte des clients',
    body: (
      <p>
        Les paiements par carte des clients du commerce passent par le prestataire choisi par le commerçant (SumUp, Stripe ou sa banque), selon le
        contrat qu&apos;il a conclu directement avec lui. {BRAND} transmet le montant au terminal et enregistre le résultat ; il ne perçoit aucune
        commission sur ces paiements et n&apos;est pas partie à ce contrat.
      </p>
    ),
  },
  {
    id: 'donnees',
    title: 'Données du commerçant et export',
    body: (
      <>
        <p>
          Les données saisies ou produites par le commerce (ventes, paiements, catalogue, stock, clients) lui appartiennent. Elles sont hébergées
          chez <V value={HOST.name} />.
        </p>
        <p>
          Le commerçant peut à tout moment les exporter depuis les paramètres : ventes, paiements, catalogue, stock et clients au format CSV
          (lisible dans Excel ou LibreOffice), clôtures en tableur et archives fiscales signées.
        </p>
      </>
    ),
  },
  {
    id: 'disponibilite',
    title: 'Disponibilité, maintenance et support',
    review: true,
    body: (
      <>
        <p>
          L&apos;éditeur fait ses meilleurs efforts pour que le service soit accessible en continu, et le fonctionnement hors ligne permet
          d&apos;encaisser pendant une coupure. Des interruptions peuvent avoir lieu pour maintenance, si possible en dehors des heures
          d&apos;ouverture des commerces.
        </p>
        <p>
          Le support répond depuis le menu Aide de l&apos;application, selon les horaires et délais qui y sont affichés.
        </p>
      </>
    ),
  },
  {
    id: 'responsabilite',
    title: 'Responsabilité',
    review: true,
    body: (
      <>
        <p>
          L&apos;éditeur répond des manquements à ses obligations au titre de ces conditions. Il n&apos;est pas responsable des conséquences
          d&apos;une mauvaise utilisation du service, d&apos;informations inexactes saisies par le commerçant, d&apos;une panne du matériel, du
          réseau ou d&apos;un prestataire de paiement choisi par le commerçant.
        </p>
        <p>
          Le commerçant reste responsable de ses déclarations fiscales et sociales, et de la tenue de sa comptabilité.
        </p>
      </>
    ),
  },
  {
    id: 'suspension',
    title: 'Suspension et fin de l’accès',
    review: true,
    body: (
      <p>
        En cas d&apos;usage contraire à ces conditions ou à la loi, ou de menace pour la sécurité du service, l&apos;éditeur peut suspendre un accès
        après en avoir informé le titulaire du compte, sauf urgence. La fin de l&apos;abonnement et le sort des données sont décrits dans les{' '}
        <Link href="/legal/cgv#resiliation">conditions générales de vente</Link>.
      </p>
    ),
  },
  {
    id: 'modifications',
    title: 'Modification des conditions',
    review: true,
    body: (
      <p>
        Ces conditions peuvent évoluer avec le service. Chaque version porte une date et une référence. Le titulaire du compte est informé
        d&apos;une nouvelle version avant son entrée en vigueur et peut résilier s&apos;il ne l&apos;accepte pas.
      </p>
    ),
  },
  {
    id: 'droit',
    title: 'Droit applicable et contact',
    review: true,
    body: (
      <p>
        Ces conditions sont soumises au droit français. Pour toute question : <Mail value={EDITOR.email} />.
      </p>
    ),
  },
]

export default function CguPage() {
  return (
    <LegalDoc
      slug="cgu"
      title="Conditions générales d'utilisation"
      intro={<p>Ce que vous pouvez attendre de {BRAND}, et ce que nous attendons de vous, quand vous utilisez la caisse.</p>}
      sections={sections}
    />
  )
}
