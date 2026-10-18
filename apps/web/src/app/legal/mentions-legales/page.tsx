import type { Metadata } from 'next'
import Link from 'next/link'
import { BRAND } from '@/lib/brand'
import { EDITOR, HOST } from '@/lib/legal'
import { LegalDoc, Mail, Missing, V, type LegalSection } from '../_ui'

export const metadata: Metadata = {
  title: 'Mentions légales',
  description: `Éditeur, directeur de la publication et hébergeur du site et du service ${BRAND}.`,
}

function EditorIdentity() {
  const e = EDITOR
  if (e.individual) {
    return (
      <dl>
        <dt>Éditeur</dt>
        <dd>
          <V value={e.company} />, entrepreneur individuel (EI)
        </dd>
        <dt>Adresse</dt>
        <dd>
          <V value={e.address} />
        </dd>
        <dt>Immatriculation</dt>
        <dd>
          SIREN <V value={e.siren} />, <V value={e.registry} />
        </dd>
      </dl>
    )
  }
  return (
    <dl>
      <dt>Éditeur</dt>
      <dd>
        <V value={e.company} />, <V value={e.status} /> au capital de <V value={e.capital} />
      </dd>
      <dt>Siège social</dt>
      <dd>
        <V value={e.address} />
      </dd>
      <dt>Immatriculation</dt>
      <dd>
        SIREN <V value={e.siren} />, <V value={e.registry} />
      </dd>
      <dt>Représentant légal</dt>
      <dd>
        <V value={e.representative} />
      </dd>
    </dl>
  )
}

const sections: LegalSection[] = [
  {
    id: 'editeur',
    title: 'Éditeur du site et du service',
    body: (
      <>
        <p>
          Le site et le logiciel de caisse {BRAND} sont édités par :
        </p>
        <div className="mt-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
          <EditorIdentity />
          <dl>
            <dt>TVA</dt>
            <dd>
              {EDITOR.vatFranchise ? (
                'TVA non applicable, article 293 B du code général des impôts.'
              ) : (
                <>
                  Numéro individuel d&apos;identification à la TVA : <V value={EDITOR.vatNumber} />
                </>
              )}
            </dd>
          </dl>
        </div>
      </>
    ),
  },
  {
    id: 'contact',
    title: 'Nous contacter',
    body: (
      <dl>
        <dt>Adresse électronique</dt>
        <dd>
          <Mail value={EDITOR.email} />
        </dd>
        <dt>Téléphone</dt>
        <dd>
          <V value={EDITOR.phone} />
        </dd>
        <dt>Depuis l&apos;application</dt>
        <dd>Les commerçants abonnés écrivent au support depuis le menu Aide de la caisse.</dd>
      </dl>
    ),
  },
  {
    id: 'publication',
    title: 'Directeur de la publication',
    body: (
      <p>
        <V value={EDITOR.director} />
      </p>
    ),
  },
  {
    id: 'hebergeur',
    title: 'Hébergeur',
    body: (
      <dl>
        <dt>Nom ou dénomination</dt>
        <dd>
          <V value={HOST.name} />
        </dd>
        <dt>Adresse</dt>
        <dd>
          <V value={HOST.address} />
        </dd>
        <dt>Téléphone</dt>
        <dd>
          <V value={HOST.phone} />
        </dd>
      </dl>
    ),
  },
  {
    id: 'propriete',
    title: 'Propriété intellectuelle',
    body: (
      <>
        <p>
          Le nom {BRAND}, son logo, le site et le logiciel sont protégés. Toute reproduction sans autorisation écrite de l&apos;éditeur est
          interdite.
        </p>
        <p>
          Photographies du site : Unsplash (Vitaly Gariev, SumUp, Clark Street Mercantile, Ulysse Pointcheval, Zayed Ahmed Zadu, Benjamin DeYoung,
          Ana Maltez, Marquise de Photographie). Captures d&apos;écran : la caisse {BRAND}.
        </p>
      </>
    ),
  },
  {
    id: 'donnees',
    title: 'Données personnelles et traceurs',
    body: (
      <p>
        Le traitement des données personnelles est décrit dans la{' '}
        <Link href="/legal/confidentialite">politique de confidentialité de {BRAND}</Link>. L&apos;usage du service est régi par les{' '}
        <Link href="/legal/cgu">conditions générales d&apos;utilisation</Link> et l&apos;abonnement par les{' '}
        <Link href="/legal/cgv">conditions générales de vente</Link>.
      </p>
    ),
  },
]

export default function MentionsLegalesPage() {
  const anyMissing = !EDITOR.company || !EDITOR.siren || !EDITOR.director || !HOST.name
  return (
    <LegalDoc
      slug="mentions-legales"
      title="Mentions légales"
      intro={
        <p>
          Les informations qui permettent d&apos;identifier l&apos;éditeur de ce site et son hébergeur, conformément à la loi n° 2004-575 du
          21 juin 2004 pour la confiance dans l&apos;économie numérique.
          {anyMissing && (
            <>
              {' '}
              Les champs marqués <Missing /> restent à renseigner.
            </>
          )}
        </p>
      }
      sections={sections}
    />
  )
}
