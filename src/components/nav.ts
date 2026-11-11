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
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Shown in the mobile bottom bar (max 5). */
  mobile: boolean
}

export const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, mobile: true },
  { to: '/squad', label: 'Squad', icon: Users, mobile: true },
  { to: '/development', label: 'Development', icon: TrendingUp, mobile: true },
  { to: '/compare', label: 'Compare', icon: Scale, mobile: false },
  { to: '/staff', label: 'Staff', icon: UserCog, mobile: false },
  { to: '/scouting', label: 'Scouting', icon: Binoculars, mobile: true },
  { to: '/world', label: 'World', icon: Globe, mobile: true },
  { to: '/competitions', label: 'Competitions', icon: Shield, mobile: false },
  { to: '/achievements', label: 'Achievements', icon: Trophy, mobile: false },
  { to: '/careers', label: 'Careers', icon: Briefcase, mobile: false },
  { to: '/import', label: 'Import', icon: Upload, mobile: false },
  { to: '/check', label: 'Check in game', icon: ClipboardCheck, mobile: false },
  { to: '/explain', label: 'How it works', icon: Lightbulb, mobile: false },
  { to: '/settings', label: 'Settings', icon: Settings, mobile: false },
]
