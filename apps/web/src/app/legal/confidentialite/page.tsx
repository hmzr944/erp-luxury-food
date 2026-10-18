import type { Metadata } from 'next'
import Link from 'next/link'
import { BRAND } from '@/lib/brand'
import { EDITOR, HOST } from '@/lib/legal'
import { LegalDoc, Mail, Missing, Review, V, type LegalSection } from '../_ui'

export const metadata: Metadata = {
  title: 'Politique de confidentialité',
  description: `Données traitées par ${BRAND} pour les commerçants et pour le compte de leurs clients, sous-traitants, durées de conservation et droits.`,
}

const cell = 'border-b border-[var(--color-border)] py-3 pr-4 align-top'
const head = 'border-b border-[var(--color-border-strong)] py-2 pr-4 text-[14px] font-semibold text-[var(--color-text-secondary)]'

function Table({ caption, cols, rows }: { caption: string; cols: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[34rem] border-collapse text-left text-[15px] leading-relaxed">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c} scope="col" className={head}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) =>
                j === 0 ? (
                  <th key={j} scope="row" className={`${cell} font-semibold`}>
                    {c}
                  </th>
                ) : (
                  <td key={j} className={cell}>
                    {c}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const sections: LegalSection[] = [
  {
    id: 'roles',
    title: 'Qui traite vos données',
    body: (
      <>
        <p>
          {BRAND} est édité par <V value={EDITOR.company} /> (voir les <Link href="/legal/mentions-legales">mentions légales</Link>). Selon les
          données, nous agissons dans deux rôles distincts :
        </p>
        <ul>
          <li>
            <strong>responsable de traitement</strong> pour les données des commerçants abonnés et de leurs équipes : comptes, abonnement,
            support, sécurité ;
          </li>
          <li>
            <strong>sous-traitant</strong> (article 28 du RGPD) pour les données des clients des commerçants (fichier fidélité, reçus et factures
            envoyés par e-mail) : le commerçant en est responsable, et nous ne les traitons que pour son compte et selon ses instructions.
          </li>
        </ul>
        <p>
          Contact pour vos données : <Mail value={EDITOR.privacyEmail} />
          {EDITOR.dpo ? <>. Délégué à la protection des données : {EDITOR.dpo}.</> : '.'}
        </p>
      </>
    ),
  },
  {
    id: 'commercants',
    title: 'Données des commerçants et de leurs équipes',
    review: true,
    body: (
      <>
        <p>Nous traitons ces données en tant que responsable de traitement :</p>
        <Table
          caption="Traitements dont FLŌW est responsable"
          cols={['Finalité', 'Données', 'Base légale']}
          rows={[
            [
              'Créer et faire fonctionner le compte',
              "Nom, prénom, e-mail, rôle, mot de passe (stocké sous forme d'empreinte), empreinte du code vendeur ou du badge, identité du commerce",
              'Exécution du contrat',
            ],
            ['Preuve de l’acceptation des conditions', 'Date et version des conditions acceptées', 'Intérêt légitime'],
            [
              'Abonnement et facturation',
              'Offre, nombre de boutiques, identifiant client chez Stripe, état du paiement (les numéros de carte restent chez Stripe)',
              'Exécution du contrat, obligations comptables',
            ],
            ['Support', 'Messages échangés, nom de l’auteur, boutique concernée', 'Exécution du contrat'],
            [
              'Sécurité et journal des opérations sensibles',
              'Action, date, utilisateur, appareil de caisse, adresse IP',
              'Intérêt légitime (sécurité du service) et obligations fiscales',
            ],
            [
              'E-mails de service',
              'E-mail : réinitialisation du mot de passe, alertes de caisse non clôturée, réponses du support',
              'Exécution du contrat',
            ],
          ]}
        />
        <p>Nous n&apos;utilisons pas ces données pour de la publicité et ne les vendons pas.</p>
      </>
    ),
  },
  {
    id: 'clients-finaux',
    title: 'Données des clients des commerçants',
    review: true,
    body: (
      <>
        <p>
          Quand un commerçant utilise le fichier fidélité ou envoie un reçu ou une facture par e-mail, {BRAND} traite pour son compte :
        </p>
        <ul>
          <li>fidélité : prénom, nom, téléphone, e-mail, points, montant total des achats, nombre de visites, date de la dernière visite ;</li>
          <li>accord du client pour recevoir des offres, enregistré à part de l&apos;inscription à la fidélité ;</li>
          <li>reçu par e-mail : adresse e-mail saisie à la caisse ;</li>
          <li>facture : dénomination, SIRET, numéro de TVA, adresse et e-mail de l&apos;entreprise cliente.</li>
        </ul>
        <p>
          Le commerçant informe ses clients et répond à leurs demandes. Il peut effacer un client depuis la caisse : la fiche disparaît, les
          ventes restent enregistrées sans lien avec elle, car les tickets signés ne peuvent pas être modifiés (article 286 du code général des
          impôts). Les engagements de {BRAND} en tant que sous-traitant (confidentialité, sécurité, aide au commerçant, sort des données en fin de
          contrat) font l&apos;objet d&apos;un accord de sous-traitance : <Missing />.
        </p>
        <p>
          Si vous êtes client d&apos;un commerce et souhaitez exercer vos droits, adressez-vous à ce commerce. Si vous nous écrivez, nous lui
          transmettons votre demande.
        </p>
      </>
    ),
  },
  {
    id: 'sous-traitants',
    title: 'Destinataires et sous-traitants',
    review: true,
    body: (
      <>
        <p>
          Les données sont accessibles aux seules personnes qui en ont besoin : l&apos;équipe du commerce selon ses rôles, et l&apos;équipe{' '}
          {BRAND} pour le support et l&apos;exploitation. Nous faisons appel à ces prestataires :
        </p>
        <Table
          caption="Sous-traitants de FLŌW"
          cols={['Prestataire', 'Rôle', 'Lieu de traitement']}
          rows={[
            [<V key="h" value={HOST.name} />, 'Hébergement des serveurs et des bases de données', <Missing key="l" />],
            ['Stripe', 'Paiement de l’abonnement', <Missing key="l" />],
            ['Resend', 'Envoi des e-mails (reçus, factures, réinitialisation, alertes)', <Missing key="l" />],
          ]}
        />
        <p>
          Les terminaux de paiement que le commerçant relie à la caisse (SumUp, Stripe) relèvent de son propre contrat avec ces prestataires. Si
          des données sont transférées hors de l&apos;Union européenne, les garanties applicables sont indiquées ici : <Missing />.
        </p>
      </>
    ),
  },
  {
    id: 'conservation',
    title: 'Durées de conservation',
    review: true,
    body: (
      <>
        <Table
          caption="Durées de conservation"
          cols={['Données', 'Durée']}
          rows={[
            ['Lien de réinitialisation du mot de passe', 'Valable une heure, utilisable une seule fois'],
            ['Fiche d’un client du commerce', 'Jusqu’à son effacement par le commerçant, ou la fin du contrat : durée après la fin du contrat à définir'],
            [
              'Tickets, clôtures et archives fiscales',
              'Non modifiables ni effaçables pendant l’abonnement (inaltérabilité) ; durée après la fin du contrat à définir',
            ],
            ['Compte du commerçant et de son équipe', 'Durée de l’abonnement, puis à définir'],
            ['Journal de sécurité', 'À définir'],
            ['Messages de support', 'À définir'],
          ]}
        />
      </>
    ),
  },
  {
    id: 'appareil',
    title: 'Stockage sur votre appareil et traceurs',
    review: true,
    body: (
      <>
        <p>La caisse enregistre sur l&apos;appareil ce qui est nécessaire à son fonctionnement :</p>
        <ul>
          <li>les jetons de connexion, pour rester connecté ;</li>
          <li>les ventes signées hors ligne, jusqu&apos;à leur envoi au serveur, et les réglages de la caisse.</li>
        </ul>
        <p>
          Le site n&apos;utilise ni traceur publicitaire ni outil de mesure d&apos;audience. C&apos;est pourquoi aucun bandeau de consentement
          n&apos;est affiché.
        </p>
      </>
    ),
  },
  {
    id: 'securite',
    title: 'Sécurité',
    body: (
      <p>
        Connexions chiffrées, mots de passe et codes vendeur conservés sous forme d&apos;empreinte, sessions révocables, droits par rôle et
        journal des opérations sensibles. Les tickets sont signés et chaînés : toute modification serait détectée.
      </p>
    ),
  },
  {
    id: 'droits',
    title: 'Vos droits',
    body: (
      <>
        <p>
          Vous pouvez demander l&apos;accès à vos données, leur rectification, leur effacement, la limitation du traitement, vous opposer à un
          traitement fondé sur l&apos;intérêt légitime, et recevoir vos données dans un format réutilisable. Écrivez à{' '}
          <Mail value={EDITOR.privacyEmail} />. Nous répondons dans un délai d&apos;un mois.
        </p>
        <p>
          Certaines données ne peuvent pas être effacées tant que la loi impose de les conserver, notamment les données de caisse soumises à
          l&apos;article 286 du code général des impôts.
        </p>
      </>
    ),
  },
  {
    id: 'cnil',
    title: 'Réclamation auprès de la CNIL',
    body: (
      <p>
        Si vous estimez que vos données ne sont pas traitées correctement, vous pouvez adresser une réclamation à la Commission nationale de
        l&apos;informatique et des libertés : en ligne sur{' '}
        <a href="https://www.cnil.fr/fr/adresser-une-plainte" rel="noopener noreferrer">
          la page « Adresser une plainte » du site de la CNIL
        </a>
        , ou par courrier : CNIL, Service des plaintes, 3 place de Fontenoy, 75007 Paris.
      </p>
    ),
  },
  {
    id: 'modifications',
    title: 'Modifications',
    body: (
      <p>
        Cette politique évolue avec le service. Chaque version porte une date et une référence ; les changements importants sont annoncés aux
        titulaires de compte. <Review />
      </p>
    ),
  },
]

export default function ConfidentialitePage() {
  return (
    <LegalDoc
      slug="confidentialite"
      title="Politique de confidentialité"
      intro={
        <p>
          Quelles données {BRAND} traite, pourquoi, avec quels prestataires, combien de temps, et comment exercer vos droits (articles 13 et 28 du
          règlement général sur la protection des données).
        </p>
      }
      sections={sections}
    />
  )
}
