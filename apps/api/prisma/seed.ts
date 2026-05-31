import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()
const BCRYPT_ROUNDS = 12

async function main() {
  console.log('Seeding Sprint 4 data...')

  await prisma.productAllergen.deleteMany()
  await prisma.stockMovement.deleteMany()
  await prisma.stockItem.deleteMany()
  await prisma.dayClosure.deleteMany()
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.variant.deleteMany()
  await prisma.product.deleteMany()
  await prisma.category.deleteMany()
  await prisma.userSite.deleteMany()
  await prisma.receiptChain.deleteMany()
  await prisma.user.deleteMany()
  await prisma.site.deleteMany()
  await prisma.organization.deleteMany()
  // Allergènes INCO : idempotent — on garde si déjà présents
  await prisma.allergen.deleteMany()

  const org = await prisma.organization.create({
    data: { name: 'Maison Artisane', slug: 'maison-artisane', plan: 'PRO' },
  })

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

  console.log(`✓ Organisation: ${org.name}`)
  console.log(`✓ Sites: ${siteChocolat.name} | ${siteCafe.name}`)
  console.log(`✓ Catégories: 4 | Produits: ${productsData.length}`)
  console.log(`✓ Allergènes INCO: ${allergensSeed.length}`)
  console.log(`✓ Stock initialisé: ${stockData.length} entrées`)
  console.log(`✓ Comptes:`)
  console.log(`  - ${owner.email} [OWNER] — Owner1234!`)
  console.log(`  - ${manager.email} [MANAGER] — Manager1234!`)
  console.log(`  - ${seller.email} [SELLER] — Seller1234!`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
