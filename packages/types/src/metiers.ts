import { Sector } from './enums'

// Métiers proposés à l'inscription : chacun règle un secteur (TVA, moyens de
// paiement, fiches produit) et charge un catalogue d'exemple pour essayer la
// caisse tout de suite. Prix indicatifs, taux de TVA usuels : le commerçant
// les vérifie et les remplace par les siens.

export interface StarterModifierGroup {
  name: string
  minSelect: number
  maxSelect: number | null
  modifiers: Array<{ name: string; price?: number }>
}

export interface StarterProduct {
  name: string
  subtitle?: string
  category: string
  price: number
  taxRate: number
  // Déclinaisons : toutes les combinaisons sont créées au prix du produit
  options?: Array<{ name: string; values: string[] }>
  // Prix au kilo
  soldByWeight?: boolean
  modifierGroups?: string[]
}

export interface StarterMenu {
  name: string
  subtitle?: string
  category: string
  price: number
  steps: Array<{ name: string; choices: string[] }>
}

export interface Metier {
  key: string
  label: string
  hint: string
  sector: Sector
  // Taux par défaut des nouveaux articles, s'il diffère de celui du secteur
  defaultTaxRate?: number
  // Affiché sous « Autre activité » plutôt que dans les huit visuels
  secondary?: boolean
  categories: Array<{ name: string; color: string }>
  modifierGroups?: StarterModifierGroup[]
  products: StarterProduct[]
  menus?: StarterMenu[]
}

const SIZES = ['S', 'M', 'L', 'XL']

export const METIERS: Metier[] = [
  {
    key: 'boulangerie',
    label: 'Boulangerie et pâtisserie',
    hint: 'Pains au poids, viennoiseries, formule déjeuner',
    sector: Sector.FOOD,
    categories: [
      { name: 'Pains', color: '#C08A4A' },
      { name: 'Viennoiseries', color: '#E0B05A' },
      { name: 'Pâtisseries', color: '#B5566E' },
      { name: 'Snacking', color: '#5B8A5F' },
    ],
    products: [
      { name: 'Baguette tradition', category: 'Pains', price: 1.3, taxRate: 5.5 },
      { name: 'Pain de campagne', subtitle: 'Au poids', category: 'Pains', price: 7.2, taxRate: 5.5, soldByWeight: true },
      { name: 'Croissant', category: 'Viennoiseries', price: 1.4, taxRate: 5.5 },
      { name: 'Pain au chocolat', category: 'Viennoiseries', price: 1.5, taxRate: 5.5 },
      { name: 'Chausson aux pommes', category: 'Viennoiseries', price: 2.2, taxRate: 5.5 },
      { name: 'Éclair au café', category: 'Pâtisseries', price: 3.8, taxRate: 5.5 },
      { name: 'Tarte aux fraises', subtitle: 'La part', category: 'Pâtisseries', price: 4.5, taxRate: 5.5 },
      { name: 'Flan pâtissier', subtitle: 'La part', category: 'Pâtisseries', price: 3.2, taxRate: 5.5 },
      { name: 'Sandwich jambon-beurre', category: 'Snacking', price: 5.5, taxRate: 10 },
      { name: 'Quiche lorraine', category: 'Snacking', price: 4.9, taxRate: 10 },
      { name: 'Café', category: 'Snacking', price: 1.8, taxRate: 10 },
      { name: 'Jus d’orange', subtitle: '25 cl', category: 'Snacking', price: 2.8, taxRate: 10 },
    ],
    menus: [
      {
        name: 'Formule déjeuner',
        subtitle: 'Sandwich, boisson, dessert',
        category: 'Snacking',
        price: 9.9,
        steps: [
          { name: 'Plat', choices: ['Sandwich jambon-beurre', 'Quiche lorraine'] },
          { name: 'Boisson', choices: ['Café', 'Jus d’orange'] },
          { name: 'Dessert', choices: ['Éclair au café', 'Flan pâtissier'] },
        ],
      },
    ],
  },
  {
    key: 'restauration',
    label: 'Restauration et vente à emporter',
    hint: 'Menus, cuissons et suppléments',
    sector: Sector.FOOD,
    defaultTaxRate: 10,
    categories: [
      { name: 'Plats', color: '#B5566E' },
      { name: 'Accompagnements', color: '#E0B05A' },
      { name: 'Boissons', color: '#4A7FC0' },
      { name: 'Desserts', color: '#8A5BB5' },
    ],
    modifierGroups: [
      { name: 'Cuisson', minSelect: 1, maxSelect: 1, modifiers: [{ name: 'Saignant' }, { name: 'À point' }, { name: 'Bien cuit' }] },
      { name: 'Suppléments', minSelect: 0, maxSelect: 3, modifiers: [{ name: 'Cheddar', price: 1 }, { name: 'Bacon', price: 1.5 }, { name: 'Œuf', price: 1 }] },
      { name: 'Sans', minSelect: 0, maxSelect: null, modifiers: [{ name: 'Sans oignons' }, { name: 'Sans sauce' }, { name: 'Sans salade' }] },
    ],
    products: [
      { name: 'Burger maison', category: 'Plats', price: 12.5, taxRate: 10, modifierGroups: ['Cuisson', 'Suppléments', 'Sans'] },
      { name: 'Burger végétarien', category: 'Plats', price: 12, taxRate: 10, modifierGroups: ['Suppléments', 'Sans'] },
      { name: 'Salade César', category: 'Plats', price: 11, taxRate: 10, modifierGroups: ['Sans'] },
      { name: 'Frites maison', category: 'Accompagnements', price: 3.5, taxRate: 10 },
      { name: 'Salade verte', category: 'Accompagnements', price: 3, taxRate: 10 },
      { name: 'Eau minérale', subtitle: '50 cl', category: 'Boissons', price: 2.5, taxRate: 10 },
      { name: 'Limonade artisanale', subtitle: '33 cl', category: 'Boissons', price: 3.5, taxRate: 10 },
      { name: 'Bière pression', subtitle: '25 cl', category: 'Boissons', price: 4.5, taxRate: 20 },
      { name: 'Café', category: 'Boissons', price: 1.8, taxRate: 10 },
      { name: 'Fondant au chocolat', category: 'Desserts', price: 4.5, taxRate: 10 },
      { name: 'Cookie', category: 'Desserts', price: 2.5, taxRate: 10 },
    ],
    menus: [
      {
        name: 'Menu burger',
        subtitle: 'Burger, accompagnement, boisson',
        category: 'Plats',
        price: 15.9,
        steps: [
          { name: 'Burger', choices: ['Burger maison', 'Burger végétarien'] },
          { name: 'Accompagnement', choices: ['Frites maison', 'Salade verte'] },
          { name: 'Boisson', choices: ['Eau minérale', 'Limonade artisanale'] },
        ],
      },
    ],
  },
  {
    key: 'epicerie',
    label: 'Épicerie fine',
    hint: 'Produits au poids, coffrets, dates limites',
    sector: Sector.FOOD,
    categories: [
      { name: 'Épicerie salée', color: '#5B8A5F' },
      { name: 'Épicerie sucrée', color: '#E0B05A' },
      { name: 'Fromagerie', color: '#C08A4A' },
      { name: 'Coffrets', color: '#B5566E' },
    ],
    products: [
      { name: 'Huile d’olive vierge extra', subtitle: '50 cl', category: 'Épicerie salée', price: 14.9, taxRate: 5.5 },
      { name: 'Vinaigre balsamique', subtitle: '25 cl', category: 'Épicerie salée', price: 9.5, taxRate: 5.5 },
      { name: 'Pâtes artisanales', subtitle: '500 g', category: 'Épicerie salée', price: 4.9, taxRate: 5.5 },
      { name: 'Saucisson sec', category: 'Épicerie salée', price: 9.9, taxRate: 5.5 },
      { name: 'Miel de lavande', subtitle: '250 g', category: 'Épicerie sucrée', price: 8.9, taxRate: 5.5 },
      { name: 'Confiture d’abricot', subtitle: '320 g', category: 'Épicerie sucrée', price: 6.5, taxRate: 5.5 },
      { name: 'Tablette chocolat noir', subtitle: '100 g', category: 'Épicerie sucrée', price: 5.9, taxRate: 5.5 },
      { name: 'Thé vert', subtitle: '100 g', category: 'Épicerie sucrée', price: 12, taxRate: 5.5 },
      { name: 'Comté 18 mois', subtitle: 'Au poids', category: 'Fromagerie', price: 32, taxRate: 5.5, soldByWeight: true },
      { name: 'Tomme de brebis', subtitle: 'Au poids', category: 'Fromagerie', price: 28, taxRate: 5.5, soldByWeight: true },
      { name: 'Coffret découverte', category: 'Coffrets', price: 39, taxRate: 5.5 },
    ],
  },
  {
    key: 'mode',
    label: 'Mode et textile',
    hint: 'Tailles et couleurs, retours et échanges',
    sector: Sector.FASHION,
    categories: [
      { name: 'Hauts', color: '#4A7FC0' },
      { name: 'Bas', color: '#5B8A5F' },
      { name: 'Accessoires', color: '#B5566E' },
    ],
    products: [
      { name: 'T-shirt coton bio', category: 'Hauts', price: 29, taxRate: 20, options: [{ name: 'Taille', values: SIZES }, { name: 'Couleur', values: ['Blanc', 'Noir'] }] },
      { name: 'Chemise en lin', category: 'Hauts', price: 59, taxRate: 20, options: [{ name: 'Taille', values: SIZES }] },
      { name: 'Pull en laine', category: 'Hauts', price: 89, taxRate: 20, options: [{ name: 'Taille', values: SIZES }] },
      { name: 'Robe midi', category: 'Hauts', price: 69, taxRate: 20, options: [{ name: 'Taille', values: ['36', '38', '40', '42'] }] },
      { name: 'Jean droit', category: 'Bas', price: 79, taxRate: 20, options: [{ name: 'Taille', values: ['36', '38', '40', '42', '44'] }] },
      { name: 'Pantalon chino', category: 'Bas', price: 65, taxRate: 20, options: [{ name: 'Taille', values: ['38', '40', '42', '44'] }] },
      { name: 'Écharpe', category: 'Accessoires', price: 35, taxRate: 20 },
      { name: 'Ceinture cuir', category: 'Accessoires', price: 45, taxRate: 20 },
      { name: 'Sac cabas', category: 'Accessoires', price: 49, taxRate: 20 },
      { name: 'Chaussettes', subtitle: 'Lot de 2', category: 'Accessoires', price: 12, taxRate: 20 },
    ],
  },
  {
    key: 'beaute',
    label: 'Coiffure et beauté',
    hint: 'Prestations et produits revendus',
    sector: Sector.BEAUTY,
    categories: [
      { name: 'Prestations', color: '#8A5BB5' },
      { name: 'Produits', color: '#B5566E' },
    ],
    products: [
      { name: 'Coupe femme', category: 'Prestations', price: 45, taxRate: 20 },
      { name: 'Coupe homme', category: 'Prestations', price: 25, taxRate: 20 },
      { name: 'Brushing', category: 'Prestations', price: 30, taxRate: 20 },
      { name: 'Couleur', category: 'Prestations', price: 60, taxRate: 20 },
      { name: 'Soin du visage', category: 'Prestations', price: 55, taxRate: 20 },
      { name: 'Manucure', category: 'Prestations', price: 30, taxRate: 20 },
      { name: 'Shampooing', subtitle: '250 ml', category: 'Produits', price: 18, taxRate: 20 },
      { name: 'Masque capillaire', subtitle: '200 ml', category: 'Produits', price: 24, taxRate: 20 },
      { name: 'Crème hydratante', subtitle: '50 ml', category: 'Produits', price: 32, taxRate: 20 },
      { name: 'Huile sèche', subtitle: '100 ml', category: 'Produits', price: 28, taxRate: 20 },
    ],
  },
  {
    key: 'detail',
    label: 'Commerce de détail',
    hint: 'Codes-barres, stock, cartes cadeaux',
    sector: Sector.GENERAL,
    categories: [
      { name: 'Papeterie', color: '#4A7FC0' },
      { name: 'Maison', color: '#C08A4A' },
      { name: 'Accessoires', color: '#5B8A5F' },
    ],
    products: [
      { name: 'Carnet A5', category: 'Papeterie', price: 8.9, taxRate: 20 },
      { name: 'Stylo plume', category: 'Papeterie', price: 14.9, taxRate: 20 },
      { name: 'Carte postale', category: 'Papeterie', price: 1.5, taxRate: 20 },
      { name: 'Bougie parfumée', category: 'Maison', price: 19, taxRate: 20 },
      { name: 'Mug en grès', category: 'Maison', price: 12, taxRate: 20 },
      { name: 'Tote bag', category: 'Accessoires', price: 15, taxRate: 20 },
      { name: 'Parapluie pliant', category: 'Accessoires', price: 24.9, taxRate: 20 },
      { name: 'Câble USB-C', subtitle: '1 m', category: 'Accessoires', price: 12.9, taxRate: 20 },
      { name: 'Piles AA', subtitle: 'Lot de 4', category: 'Accessoires', price: 6.9, taxRate: 20 },
      { name: 'Porte-clés', category: 'Accessoires', price: 7.5, taxRate: 20 },
    ],
  },
  {
    key: 'bijouterie',
    label: 'Bijouterie et joaillerie',
    hint: 'Pièces de valeur, gravure, certificats',
    sector: Sector.JEWELRY,
    categories: [
      { name: 'Bijoux', color: '#C0A04A' },
      { name: 'Montres', color: '#4A7FC0' },
      { name: 'Services', color: '#8A5BB5' },
    ],
    products: [
      { name: 'Bague en argent', category: 'Bijoux', price: 89, taxRate: 20, options: [{ name: 'Taille', values: ['50', '52', '54', '56'] }] },
      { name: 'Collier plaqué or', category: 'Bijoux', price: 69, taxRate: 20 },
      { name: 'Boucles d’oreilles', category: 'Bijoux', price: 49, taxRate: 20 },
      { name: 'Bracelet jonc', category: 'Bijoux', price: 59, taxRate: 20 },
      { name: 'Pendentif', category: 'Bijoux', price: 59, taxRate: 20 },
      { name: 'Montre automatique', category: 'Montres', price: 249, taxRate: 20 },
      { name: 'Bracelet de montre cuir', category: 'Montres', price: 39, taxRate: 20 },
      { name: 'Gravure', category: 'Services', price: 15, taxRate: 20 },
      { name: 'Nettoyage de bijou', category: 'Services', price: 10, taxRate: 20 },
      { name: 'Changement de pile', category: 'Services', price: 12, taxRate: 20 },
    ],
  },
  {
    key: 'maison',
    label: 'Maison et décoration',
    hint: 'Objets, linge de maison, listes cadeaux',
    sector: Sector.HOME,
    categories: [
      { name: 'Décoration', color: '#C08A4A' },
      { name: 'Linge de maison', color: '#5B8A5F' },
      { name: 'Art de la table', color: '#4A7FC0' },
    ],
    products: [
      { name: 'Vase en céramique', category: 'Décoration', price: 39, taxRate: 20 },
      { name: 'Bougie parfumée', category: 'Décoration', price: 24, taxRate: 20 },
      { name: 'Cadre photo', category: 'Décoration', price: 19, taxRate: 20 },
      { name: 'Lampe à poser', category: 'Décoration', price: 89, taxRate: 20 },
      { name: 'Plaid en laine', category: 'Linge de maison', price: 59, taxRate: 20 },
      { name: 'Housse de coussin', category: 'Linge de maison', price: 29, taxRate: 20, options: [{ name: 'Couleur', values: ['Sable', 'Terracotta', 'Vert sauge'] }] },
      { name: 'Torchon en lin', category: 'Linge de maison', price: 14, taxRate: 20 },
      { name: 'Assiette plate', category: 'Art de la table', price: 18, taxRate: 20 },
      { name: 'Verre à eau', category: 'Art de la table', price: 9, taxRate: 20 },
      { name: 'Panier en osier', category: 'Décoration', price: 29, taxRate: 20 },
    ],
  },
  {
    key: 'cave',
    label: 'Cave à vins et spiritueux',
    hint: 'Millésimes, appellations',
    sector: Sector.WINE,
    secondary: true,
    categories: [
      { name: 'Vins', color: '#8A2E45' },
      { name: 'Spiritueux', color: '#C08A4A' },
      { name: 'Épicerie', color: '#5B8A5F' },
    ],
    products: [
      { name: 'Côtes du Rhône rouge', subtitle: '75 cl', category: 'Vins', price: 12.9, taxRate: 20 },
      { name: 'Bourgogne blanc', subtitle: '75 cl', category: 'Vins', price: 19.5, taxRate: 20 },
      { name: 'Champagne brut', subtitle: '75 cl', category: 'Vins', price: 34, taxRate: 20 },
      { name: 'Rosé de Provence', subtitle: '75 cl', category: 'Vins', price: 14.5, taxRate: 20 },
      { name: 'Whisky single malt', subtitle: '70 cl', category: 'Spiritueux', price: 49, taxRate: 20 },
      { name: 'Rhum vieux', subtitle: '70 cl', category: 'Spiritueux', price: 39, taxRate: 20 },
      { name: 'Jus de raisin', subtitle: '75 cl', category: 'Épicerie', price: 5.9, taxRate: 5.5 },
      { name: 'Olives', subtitle: '200 g', category: 'Épicerie', price: 4.9, taxRate: 5.5 },
    ],
  },
  {
    key: 'services',
    label: 'Services et prestations',
    hint: 'Ateliers, réparations, abonnements',
    sector: Sector.SERVICES,
    secondary: true,
    categories: [{ name: 'Prestations', color: '#8A5BB5' }],
    products: [
      { name: 'Prestation d’une heure', category: 'Prestations', price: 50, taxRate: 20 },
      { name: 'Demi-heure', category: 'Prestations', price: 30, taxRate: 20 },
      { name: 'Forfait réparation', category: 'Prestations', price: 45, taxRate: 20 },
      { name: 'Atelier collectif', category: 'Prestations', price: 35, taxRate: 20 },
      { name: 'Carte de 10 séances', category: 'Prestations', price: 280, taxRate: 20 },
    ],
  },
]

export const metierByKey = (key: string | null | undefined) => METIERS.find((m) => m.key === key)
