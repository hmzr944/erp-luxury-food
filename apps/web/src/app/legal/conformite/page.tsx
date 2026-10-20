import type { Metadata } from 'next'
import Link from 'next/link'
import { BRAND } from '@/lib/brand'
import { LegalDoc, Review, type LegalSection } from '../_ui'

export const metadata: Metadata = {
  title: 'Conformité de la caisse : attestation de l’éditeur et NF525',
  description: `Ce que la loi demande à un commerçant qui encaisse des particuliers, les deux moyens de preuve depuis le 21 février 2026, et ce que fait ${BRAND}.`,
}

const BOFIP = 'https://bofip.impots.gouv.fr/bofip/15035-PGP.html/ACTU-2026-00073'

const COVERED = [
  'Enregistrement des ventes et des remboursements en caisse, en ligne et hors ligne, sur tablette, téléphone ou ordinateur.',
  'Signature de chaque ticket par la caisse (ECDSA P-256), grand livre du site chaîné par empreintes SHA-256, numérotation continue.',
  'Total perpétuel et cumul en valeur absolue, jamais remis à zéro.',
  'Clôtures journalières, mensuelles et annuelles cumulatives, scellées et chaînées.',
  'Archives périodiques au format ouvert (JSON), datées, scellées et signées par l’éditeur.',
  'Journal des événements techniques chaîné, duplicatas numérotés, mode formation identifié.',
  'Conservation des données détaillées ligne par ligne ; tables fiscales (chaîne des tickets, clôtures, journal des événements, duplicata, archives) protégées en ajout seul au niveau de la base ; détail des ventes (commandes, lignes, paiements) protégé en ajout seul une fois le ticket signé, et recalculé par la vérification du grand livre.',
]

const NOT_COVERED = [
  'Facturation entre professionnels (factures B2B) et facturation électronique.',
  'Commandes internes entre boutiques et laboratoire, gestion des stocks et des produits.',
  'Paiements encaissés hors de FLŌW (terminal de paiement autonome non relié).',
]

const sections: LegalSection[] = [
  {
    id: 'obligation',
    title: 'Qu’est-ce qui est obligatoire ?',
    body: (
      <>
        <p>
          Un commerçant qui enregistre les paiements de clients particuliers avec un logiciel ou un système de caisse doit pouvoir prouver que ce
          logiciel respecte des conditions d’inaltérabilité, de sécurisation, de conservation et d’archivage des données, en vue d’un contrôle de
          l’administration fiscale. La règle figure à l’article 286, I, 3° bis du code général des impôts.
        </p>
        <p>
          Ce qui est demandé au commerçant, c’est un justificatif pour chaque logiciel de caisse qu’il utilise. Le détail des conditions est dans
          la doctrine fiscale (BOI-TVA-DECLA-30-10-30).
        </p>
      </>
    ),
  },
  {
    id: 'preuves',
    title: 'Quels moyens de preuve depuis le 21 février 2026 ?',
    body: (
      <>
        <p>Le commerçant peut produire l’un ou l’autre de ces deux justificatifs :</p>
        <ul>
          <li>le certificat délivré par un organisme accrédité (la certification NF525 en est un exemple) ;</li>
          <li>l’attestation individuelle établie par l’éditeur du logiciel, selon un modèle officiel.</li>
        </ul>
        <p>
          L’attestation individuelle a été rétablie par l’article 125 de la loi n° 2026-103 du 19 février 2026, à compter du 21 février 2026. Le
          modèle est le BOI-LETTRE-000242, publié le 25 mars 2026.
        </p>
        <p>
          Source :{' '}
          <a href={BOFIP} rel="noopener noreferrer" target="_blank">
            BOFiP, ACTU-2026-00073
          </a>
          , publiée le 25 mars 2026.
        </p>
      </>
    ),
  },
  {
    id: 'nf525',
    title: '« J’ai lu que la certification NF525 était obligatoire au 31 août 2026 »',
    review: true,
    body: (
      <>
        <p>
          Plusieurs comparatifs et articles datent d’avant la loi du 19 février 2026 et ne sont plus à jour : ils présentent le certificat comme
          le seul moyen de preuve. Depuis le 21 février 2026, l’attestation individuelle de l’éditeur est de nouveau admise (voir la question
          précédente).
        </p>
        <p>
          La date du 31 août 2026 correspond à la prorogation du délai laissé aux éditeurs pour obtenir le certificat d’un organisme accrédité
          (publication BOFiP 14826-PGP du 1er octobre 2025). Cette publication n’est pas celle qui fixe l’obligation du commerçant, et nous
          n’en tirons rien de plus ici.
        </p>
      </>
    ),
  },
  {
    id: 'flow',
    title: `Que fait ${BRAND} ?`,
    review: true,
    body: (
      <>
        <p>
          {BRAND} délivre une attestation individuelle d’éditeur. Il n’est pas certifié par un organisme accrédité. Voici le périmètre que cette
          attestation déclare couvert, tel qu’il est écrit dans l’attestation générée par le logiciel :
        </p>
        <ul>
          {COVERED.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <h3>Ce que l’attestation ne couvre pas</h3>
        <ul>
          {NOT_COVERED.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <p>
          La clé publique de l’éditeur est consultable sans compte : un contrôleur ou un expert peut vérifier une archive ou une attestation sans
          se connecter à {BRAND}.
        </p>
      </>
    ),
  },
  {
    id: 'obtenir',
    title: 'Comment obtenir mon attestation ?',
    review: true,
    body: (
      <>
        <p>
          L’attestation comporte deux volets. Le volet 1 est établi par l’éditeur : il désigne le logiciel, sa version, son numéro de licence et
          son périmètre. Le volet 2 est rempli et signé par le commerçant : il certifie l’acquisition du logiciel et son usage pour enregistrer les
          règlements de clients particuliers.
        </p>
        <p>
          Le titulaire du compte ou le gérant la télécharge au format PDF dans l’espace{' '}
          <Link href="/compliance">Conformité</Link> de l’application (connexion requise). Elle est à conserver avec les documents comptables et à
          présenter en cas de contrôle. Une nouvelle attestation est délivrée à chaque nouvelle version majeure du logiciel.
        </p>
        <p>
          Une fausse attestation est un délit : trois ans d’emprisonnement et 45 000 € d’amende (code pénal, article 441-1), comme le rappelle le
          modèle officiel. L’usage d’une fausse attestation est passible des mêmes peines.
        </p>
      </>
    ),
  },
  {
    id: 'controle',
    title: 'Que se passe-t-il en cas de contrôle ?',
    review: true,
    body: (
      <>
        <p>
          Les deux volets de l’attestation (ou le certificat) sont à présenter à l’administration fiscale en cas de contrôle.
          L’attestation n’a de valeur que si son volet 2 est complété et signé. Les données fiscales se conservent six ans (article L102 B
          du livre des procédures fiscales).
        </p>
        <p>
          Montant de l’amende en l’absence de justificatif : <mark className="whitespace-nowrap rounded-[var(--radius-sm)] border border-dashed border-[var(--color-accent)] bg-[var(--color-accent-muted)] px-1 font-semibold">à compléter à partir d’une source officielle</mark>.
          Des sources secondaires en citent un, mais nous ne l’avons pas vérifié sur un texte officiel et nous ne l’affirmons donc pas.
        </p>
      </>
    ),
  },
  {
    id: 'limites',
    title: 'Limites et points en cours de validation',
    review: true,
    body: (
      <>
        <p>
          L’éditeur de {BRAND} est un entrepreneur individuel, alors que le modèle officiel du volet 1 est rédigé pour le représentant légal d’une
          société. La formulation adaptée à ce statut fait partie des points à faire valider.
        </p>
        <p>
          Cette page est une information, pas un conseil juridique ni fiscal. Les passages marqués « À valider » seront confirmés avant la
          mise en service commerciale. Pour votre situation, rapprochez-vous de votre expert-comptable ou du service des impôts des
          entreprises. <Review />
        </p>
      </>
    ),
  },
]

export default function ConformitePage() {
  return (
    <LegalDoc
      slug="conformite"
      title="Conformité de la caisse : attestation de l’éditeur et NF525"
      intro={
        <p>
          Ce que la loi demande à un commerçant qui encaisse des particuliers, les deux moyens de le prouver, et ce que {BRAND} fournit.
        </p>
      }
      sections={sections}
    />
  )
}
