'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

interface RevenueChartProps {
  data: Array<{ hour: string; revenue: number }>
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-3 py-2 shadow-lg">
      <p className="font-data text-[10px] text-[var(--color-text-muted)] mb-1">{label}</p>
      <p className="font-data text-sm text-[var(--color-accent)]">
        {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(
          payload[0].value,
        )}
      </p>
    </div>
  )
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E8C878" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#E8C878" stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#1F1F1F"
          vertical={false}
        />

        <XAxis
          dataKey="hour"
          tick={{ fill: '#555550', fontSize: 10, fontFamily: 'var(--font-data)' }}
          axisLine={false}
          tickLine={false}
          interval={1}
        />

        <YAxis
          tick={{ fill: '#555550', fontSize: 10, fontFamily: 'var(--font-data)' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => v > 0 ? `${v}€` : ''}
        />

        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#2A2A2A', strokeWidth: 1 }} />

        <Area
          type="monotone"
          dataKey="revenue"
          stroke="#E8C878"
          strokeWidth={1.5}
          fill="url(#revenueGrad)"
          dot={false}
          activeDot={{ r: 4, fill: '#E8C878', stroke: '#0A0A0A', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
