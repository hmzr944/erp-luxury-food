import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'
import { PACK_ATTRIBUTES, SECTOR_PRESETS, Sector } from '@erp/types'
import { buildVariantMatrix, variantLabel } from '@erp/utils'

const prisma = new PrismaClient()

// Applique les préréglages d'un secteur (même logique que PlatformService)
async function applySectorPreset(organizationId: string, sector: Sector) {
  const preset = SECTOR_PRESETS[sector]
  await prisma.organization.update({
    where: { id: organizationId },
    data: { sector, packs: preset.packs, priceIncludesTax: preset.priceIncludesTax },
  })
  await prisma.taxRate.createMany({
    data: preset.taxRates.map((t) => ({ organizationId, label: t.label, rate: t.rate, isDefault: !!t.isDefault })),
  })
  await prisma.paymentMethod.createMany({
    data: preset.paymentMethods.map((m, position) => ({ organizationId, ...m, position })),
  })
  await prisma.attributeDefinition.createMany({
    data: preset.packs.flatMap((p) => PACK_ATTRIBUTES[p]).map((a, position) => ({
      organizationId, key: a.key, label: a.label, type: a.type, options: a.options ?? [], pack: a.pack, position,
    })),
  })
}
const BCRYPT_ROUNDS = 12

async function main() {
  console.log('Seeding Sprint 4 data...')

  // Base de démonstration remise à zéro : purge explicite des tables
  // fiscales (protégées en ajout seul), dans une seule transaction
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL flow.allow_purge = 'on'`)
    await tx.productAllergen.deleteMany()
    await tx.stockMovement.deleteMany()
    await tx.stockItem.deleteMany()
    await tx.dayClosure.deleteMany()
    await tx.orderItem.deleteMany()
    await tx.order.deleteMany()
    await tx.variant.deleteMany()
    await tx.product.deleteMany()
    await tx.category.deleteMany()
    await tx.userSite.deleteMany()
    await tx.receiptChain.deleteMany()
    await tx.user.deleteMany()
    await tx.site.deleteMany()
    await tx.organization.deleteMany()
  })
  // Allergènes INCO : idempotent — on garde si déjà présents
  await prisma.allergen.deleteMany()

  const org = await prisma.organization.create({
    data: { name: 'Maison Artisane', slug: 'maison-artisane', plan: 'PRO' },
  })
  await applySectorPreset(org.id, Sector.FOOD)

  const siteChocolat = await prisma.site.create({
    data: {
      organizationId: org.id,
      name: 'Boutique Chocolat',
      address: '12 rue du Faubourg Saint-Honoré, 75008 Paris',
      timezone: 'Europe/Paris',
    },
  })

  const siteCafe = await prisma.site.create({
    data: {
      organizationId: org.id,
      name: 'Café & Épicerie',
      address: '5 place Vendôme, 75001 Paris',
      timezone: 'Europe/Paris',
    },
  })

  const [ownerHash, managerHash, sellerHash] = await Promise.all([
    bcrypt.hash('Owner1234!', BCRYPT_ROUNDS),
    bcrypt.hash('Manager1234!', BCRYPT_ROUNDS),
    bcrypt.hash('Seller1234!', BCRYPT_ROUNDS),
  ])

  const owner = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'owner@maison-artisane.fr',
      passwordHash: ownerHash,
      firstName: 'Sophie',
      lastName: 'Marchand',
      role: 'OWNER',
    },
  })

  const manager = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'manager@maison-artisane.fr',
      passwordHash: managerHash,
      firstName: 'Thomas',
      lastName: 'Delorme',
      role: 'MANAGER',
    },
  })

  const seller = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'vendeur@maison-artisane.fr',
      passwordHash: sellerHash,
      firstName: 'Léa',
      lastName: 'Fontaine',
      role: 'SELLER',
    },
  })

  await prisma.userSite.create({ data: { userId: seller.id, siteId: siteChocolat.id } })

  // ── Catégories Boutique Chocolat ──
  const catChocolats = await prisma.category.create({
    data: { siteId: siteChocolat.id, name: 'Chocolats', color: '#92400e', position: 0 },
  })
  const catCoffrets = await prisma.category.create({
    data: { siteId: siteChocolat.id, name: 'Coffrets', color: '#7c3aed', position: 1 },
  })
  const catBoissons = await prisma.category.create({
    data: { siteId: siteChocolat.id, name: 'Boissons', color: '#1d4ed8', position: 2 },
  })
  const catGlaces = await prisma.category.create({
    data: { siteId: siteChocolat.id, name: 'Glaces', color: '#0e7490', position: 3 },
  })

  // ── Produits ──
  const productsData = [
    // Chocolats
    {
      siteId: siteChocolat.id,
      categoryId: catChocolats.id,
      name: 'Ganache Grand Cru',
      subtitle: 'Mozambique 75%',
      price: 9.5,
      taxRate: 5.5,
      sku: 'CHO-001',
    },
    {
      siteId: siteChocolat.id,
      categoryId: catChocolats.id,
      name: 'Praliné Noisette',
      subtitle: 'Piémont IGP',
      price: 8.0,
      taxRate: 5.5,
      sku: 'CHO-002',
    },
    {
      siteId: siteChocolat.id,
      categoryId: catChocolats.id,
      name: 'Gianduja Noir',
      subtitle: 'Origine Équateur',
      price: 8.5,
      taxRate: 5.5,
      sku: 'CHO-003',
    },
    {
      siteId: siteChocolat.id,
      categoryId: catChocolats.id,
      name: 'Caramel Beurre Salé',
      subtitle: 'Fleur de sel de Guérande',
      price: 7.5,
      taxRate: 5.5,
      sku: 'CHO-004',
    },
    {
      siteId: siteChocolat.id,
      categoryId: catChocolats.id,
      name: 'Framboise Intense',
      subtitle: 'Couverture 66%',
      price: 9.0,
      taxRate: 5.5,
      sku: 'CHO-005',
    },
    {
      siteId: siteChocolat.id,
      categoryId: catChocolats.id,
      name: 'Menthe Fraîche',
      subtitle: 'Ganache infusée',
      price: 8.0,
      taxRate: 5.5,
      sku: 'CHO-006',
    },
    // Coffrets
    {
      siteId: siteChocolat.id,
      categoryId: catCoffrets.id,
      name: 'Coffret Découverte',
      subtitle: '6 pièces assorties',
      price: 22.0,
      taxRate: 5.5,
      sku: 'COF-001',
    },
    {
      siteId: siteChocolat.id,
      categoryId: catCoffrets.id,
      name: 'Coffret Prestige',
      subtitle: '12 pièces signature',
      price: 42.0,
      taxRate: 5.5,
      sku: 'COF-002',
    },
    {
      siteId: siteChocolat.id,
      categoryId: catCoffrets.id,
      name: 'Coffret Grand Voyage',
      subtitle: '24 origines du monde',
      price: 78.0,
      taxRate: 5.5,
      sku: 'COF-003',
    },
    // Boissons
    {
      siteId: siteChocolat.id,
      categoryId: catBoissons.id,
      name: 'Chocolat Chaud',
      subtitle: 'Recette Maison',
      price: 6.5,
      taxRate: 10,
      sku: 'BNS-001',
    },
    {
      siteId: siteChocolat.id,
      categoryId: catBoissons.id,
      name: 'Café Sélection',
      subtitle: 'Éthiopie Yirgacheffe',
      price: 4.5,
      taxRate: 10,
      sku: 'BNS-002',
    },
    // Glaces
    {
      siteId: siteChocolat.id,
      categoryId: catGlaces.id,
      name: 'Sorbet Chocolat',
      subtitle: 'Cacao Criollo',
      price: 5.5,
      taxRate: 5.5,
      sku: 'GLA-001',
    },
    {
      siteId: siteChocolat.id,
      categoryId: catGlaces.id,
      name: 'Glace Vanille Bourbon',
      subtitle: 'Madagascar',
      price: 5.0,
      taxRate: 5.5,
      sku: 'GLA-002',
    },
  ]

  await prisma.product.createMany({
    data: productsData.map((p) => ({
      ...p,
      price: p.price,
      taxRate: p.taxRate,
    })),
  })

  // ── 14 allergènes INCO (Règlement EU 1169/2011)
  const allergensSeed = [
    { name: 'Gluten',                          code: 'GLUTEN' },
    { name: 'Crustacés',                        code: 'CRUSTACES' },
    { name: 'Oeufs',                            code: 'OEUFS' },
    { name: 'Poissons',                         code: 'POISSONS' },
    { name: 'Arachides',                        code: 'ARACHIDES' },
    { name: 'Soja',                             code: 'SOJA' },
    { name: 'Lait',                             code: 'LAIT' },
    { name: 'Fruits à coque',                   code: 'FRUITS_COQUE' },
    { name: 'Céleri',                           code: 'CELERI' },
    { name: 'Moutarde',                         code: 'MOUTARDE' },
    { name: 'Graines de sésame',                code: 'SESAME' },
    { name: 'Dioxyde de soufre et sulfites',    code: 'SULFITES' },
    { name: 'Lupin',                            code: 'LUPIN' },
    { name: 'Mollusques',                       code: 'MOLLUSQUES' },
  ]
  await prisma.allergen.createMany({ data: allergensSeed, skipDuplicates: true })

  // ── Stock de démonstration (Boutique Chocolat)
  const allProducts = await prisma.product.findMany({
    where: { siteId: siteChocolat.id },
    select: { id: true, name: true },
  })

  const stockData = allProducts.map((p) => ({
    productId: p.id,
    siteId: siteChocolat.id,
    quantity: Math.floor(Math.random() * 40) + 10,
    unit: 'unité',
    alertAt: 5,
  }))
  await prisma.stockItem.createMany({ data: stockData, skipDuplicates: true })

  const fashion = await seedFashion(ownerHash)

  console.log(`✓ Organisation: ${org.name}`)
  console.log(`✓ Sites: ${siteChocolat.name} | ${siteCafe.name}`)
  console.log(`✓ Catégories: 4 | Produits: ${productsData.length}`)
  console.log(`✓ Allergènes INCO: ${allergensSeed.length}`)
  console.log(`✓ Stock initialisé: ${stockData.length} entrées`)
  console.log(`✓ Comptes:`)
  console.log(`  - ${owner.email} [OWNER] — Owner1234!`)
  console.log(`  - ${manager.email} [MANAGER] — Manager1234!`)
  console.log(`  - ${seller.email} [SELLER] — Seller1234!`)
  console.log(`✓ Organisation mode: ${fashion.name} — ${fashion.email} [OWNER] — Owner1234!`)
}

// ── Deuxième organisation : prêt-à-porter (tailles × couleurs) ──
async function seedFashion(ownerHash: string) {
  const org = await prisma.organization.create({
    data: { name: 'Atelier Sauvage', slug: 'atelier-sauvage', plan: 'PRO' },
  })
  await applySectorPreset(org.id, Sector.FASHION)

  const site = await prisma.site.create({
    data: { organizationId: org.id, name: 'Boutique Marais', address: '18 rue Vieille-du-Temple, 75004 Paris' },
  })
  const owner = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'owner@atelier-sauvage.fr',
      passwordHash: ownerHash,
      firstName: 'Inès',
      lastName: 'Garnier',
      role: 'OWNER',
    },
  })

  const [maille, chemises, accessoires] = await Promise.all(
    [
      { name: 'Maille', color: '#57534e' },
      { name: 'Chemises', color: '#1e3a5f' },
      { name: 'Accessoires', color: '#7c2d12' },
    ].map((c, position) => prisma.category.create({ data: { siteId: site.id, ...c, position } })),
  )

  const catalogue = [
    {
      categoryId: maille.id, name: 'Pull col rond', subtitle: 'Cachemire', price: 290,
      attributes: { material: 'Cachemire', season: 'Automne-hiver', care: 'Lavage main' },
      options: [{ name: 'Taille', values: ['S', 'M', 'L'] }, { name: 'Couleur', values: ['Écru', 'Marine'] }],
    },
    {
      categoryId: maille.id, name: 'Cardigan long', subtitle: 'Laine mérinos', price: 245,
      attributes: { material: 'Laine mérinos', season: 'Automne-hiver' },
      options: [{ name: 'Taille', values: ['S', 'M', 'L'] }, { name: 'Couleur', values: ['Camel', 'Gris'] }],
    },
    {
      categoryId: chemises.id, name: 'Chemise popeline', subtitle: 'Coton', price: 145,
      attributes: { material: 'Coton', season: 'Permanent' },
      options: [{ name: 'Taille', values: ['XS', 'S', 'M', 'L', 'XL'] }, { name: 'Couleur', values: ['Blanc', 'Ciel'] }],
    },
    {
      categoryId: accessoires.id, name: 'Sac cabas', subtitle: 'Cuir pleine fleur', price: 420,
      attributes: { material: 'Cuir de veau', season: 'Permanent' },
      options: [{ name: 'Couleur', values: ['Noir', 'Cognac'] }],
    },
    {
      categoryId: accessoires.id, name: 'Écharpe', subtitle: 'Cachemire et soie', price: 120,
      attributes: { material: 'Cachemire et soie', season: 'Automne-hiver' },
      options: [],
    },
  ]

  for (const item of catalogue) {
    const combos = buildVariantMatrix(item.options)
    const product = await prisma.product.create({
      data: {
        siteId: site.id,
        categoryId: item.categoryId,
        name: item.name,
        subtitle: item.subtitle,
        price: item.price,
        taxRate: 20,
        attributes: item.attributes,
        options: { create: item.options.map((o, position) => ({ ...o, position })) },
        variants: {
          create: combos.map((options, position) => ({
            name: variantLabel(options, item.options),
            price: item.price,
            options,
            position,
          })),
        },
      },
      include: { variants: true },
    })
    if (product.variants.length) {
      await prisma.variantStock.createMany({
        data: product.variants.map((v, i) => ({ variantId: v.id, siteId: site.id, quantity: (i * 7) % 6 + 1, alertAt: 1 })),
      })
    } else {
      await prisma.stockItem.create({ data: { productId: product.id, siteId: site.id, quantity: 8, alertAt: 2 } })
    }
  }

  return { name: org.name, email: owner.email }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
