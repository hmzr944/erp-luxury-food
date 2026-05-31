'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SiteInfo {
  id: string
  name: string
  timezone: string
}

interface SiteState {
  currentSite: SiteInfo | null
  sites: SiteInfo[]
  setSites: (sites: SiteInfo[]) => void
  selectSite: (site: SiteInfo) => void
}

export const useSiteStore = create<SiteState>()(
  persist(
    (set) => ({
      currentSite: null,
      sites: [],
      setSites: (sites) =>
        set((state) => ({
          sites,
          currentSite: state.currentSite ?? sites[0] ?? null,
        })),
      selectSite: (site) => set({ currentSite: site }),
    }),
    { name: 'erp-site', partialize: (s) => ({ currentSite: s.currentSite }) },
  ),
)
