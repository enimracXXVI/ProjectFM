import {
  Binoculars,
  Globe,
  Briefcase,
  Shield,
  ClipboardCheck,
  Lightbulb,
  LayoutDashboard,
  NotebookPen,
  Scale,
  Settings,
  TrendingUp,
  Trophy,
  Upload,
  UserCog,
  Users,
} from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
import { PitchIcon } from './PitchIcon'

export interface NavItem {
  to: string
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

/** Every section (the phone bottom bar can hold any of them). */
export const sections: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/notes', label: 'Notes', icon: NotebookPen },
  { to: '/squad', label: 'Squad', icon: Users },
  { to: '/tactics', label: 'Tactics', icon: PitchIcon },
  { to: '/development', label: 'Development', icon: TrendingUp },
  { to: '/compare', label: 'Compare', icon: Scale },
  { to: '/staff', label: 'Staff', icon: UserCog },
  { to: '/scouting', label: 'Scouting', icon: Binoculars },
  { to: '/world', label: 'World', icon: Globe },
  { to: '/competitions', label: 'Competitions', icon: Shield },
  { to: '/achievements', label: 'Achievements', icon: Trophy },
  { to: '/careers', label: 'Careers', icon: Briefcase },
  { to: '/import', label: 'Import', icon: Upload },
  { to: '/check', label: 'Check in game', icon: ClipboardCheck },
  { to: '/explain', label: 'How it works', icon: Lightbulb },
  { to: '/settings', label: 'Settings', icon: Settings },
]

/**
 * The sidebar and the phone's More sections: Development and Compare open from the Squad
 * page; Notes from the Dashboard; Import, Check in game and How it works from Settings.
 * All of them can still go in the phone's bottom bar.
 */
const IN_PAGES = new Set(['/development', '/compare', '/notes', '/import', '/check', '/explain'])
export const navItems: NavItem[] = sections.filter((s) => !IN_PAGES.has(s.to))
