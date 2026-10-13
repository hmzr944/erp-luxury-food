export enum Role {
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
  SELLER = 'SELLER',
  PRODUCTION = 'PRODUCTION',
}

export enum Plan {
  STARTER = 'STARTER',
  PRO = 'PRO',
  SCALE = 'SCALE',
  ENTERPRISE = 'ENTERPRISE',
}

export enum Channel {
  IN_STORE = 'IN_STORE',
  CLICK_COLLECT = 'CLICK_COLLECT',
  B2B = 'B2B',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  PREPARING = 'PREPARING',
  READY = 'READY',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentMode {
  CARD = 'CARD',
  CASH = 'CASH',
  MIXED = 'MIXED',
  INVOICE = 'INVOICE',
  TICKET_RESTO = 'TICKET_RESTO',
}

export enum MovementType {
  SALE = 'SALE',
  RESTOCK = 'RESTOCK',
  ADJUSTMENT = 'ADJUSTMENT',
  TRANSFER = 'TRANSFER',
  LOSS = 'LOSS',
}

// ── Cœur multi-secteurs ─────────────────────────────────────

export enum Sector {
  GENERAL = 'GENERAL',
  FOOD = 'FOOD',
  FASHION = 'FASHION',
  BEAUTY = 'BEAUTY',
  JEWELRY = 'JEWELRY',
  WINE = 'WINE',
  HOME = 'HOME',
  SERVICES = 'SERVICES',
}

export enum Pack {
  FOOD = 'FOOD',
  FASHION = 'FASHION',
  BEAUTY = 'BEAUTY',
  JEWELRY = 'JEWELRY',
  WINE = 'WINE',
  SERVICES = 'SERVICES',
}

export enum TrackingMode {
  NONE = 'NONE',
  LOT = 'LOT',
  LOT_EXPIRY = 'LOT_EXPIRY',
  SERIAL = 'SERIAL',
}

export enum AttributeType {
  TEXT = 'TEXT',
  NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN',
  SELECT = 'SELECT',
  DATE = 'DATE',
}

export enum PaymentKind {
  CARD = 'CARD',
  CASH = 'CASH',
  VOUCHER = 'VOUCHER',
  TRANSFER = 'TRANSFER',
  OTHER = 'OTHER',
}
