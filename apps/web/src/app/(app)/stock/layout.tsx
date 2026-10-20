import { StockSubNav } from '@/components/stock/StockSubNav'

// Toutes les pages du stock (stock, inventaire, lots et dates) partagent la sous-navigation
export default function StockLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <StockSubNav />
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}
