import {
  Binoculars,
  Globe,
  Briefcase,
  Shield,
  ClipboardCheck,
  Lightbulb,
  LayoutDashboard,
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

export const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/squad', label: 'Squad', icon: Users },
  { to: '/development', label: 'Development', icon: TrendingUp },
  { to: '/compare', label: 'Compare', icon: Scale },
  { to: '/staff', label: 'Staff', icon: UserCog },
  { to: '/scouting', label: 'Scouting', icon: Binoculars },
  { to: '/world', label: 'World', icon: Globe },
  { to: '/competitions', label: 'Competitions', icon: Shield },
  { to: '/tactics', label: 'Tactics', icon: PitchIcon },
  { to: '/achievements', label: 'Achievements', icon: Trophy },
  { to: '/careers', label: 'Careers', icon: Briefcase },
  { to: '/import', label: 'Import', icon: Upload },
  { to: '/check', label: 'Check in game', icon: ClipboardCheck },
  { to: '/explain', label: 'How it works', icon: Lightbulb },
  { to: '/settings', label: 'Settings', icon: Settings },
]
