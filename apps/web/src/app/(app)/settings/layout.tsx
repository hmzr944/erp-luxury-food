import { SettingsNav } from '@/components/settings/SettingsNav'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col md:flex-row">
      <SettingsNav />
      <div className="min-w-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}
