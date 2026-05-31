export enum Role {
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
  SELLER = 'SELLER',
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
