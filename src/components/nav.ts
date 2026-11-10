import {
  Binoculars,
  Briefcase,
  LayoutDashboard,
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
  { to: '/development', label: 'Development', icon: TrendingUp, mobile: false },
  { to: '/staff', label: 'Staff', icon: UserCog, mobile: true },
  { to: '/scouting', label: 'Scouting', icon: Binoculars, mobile: true },
  { to: '/achievements', label: 'Achievements', icon: Trophy, mobile: false },
  { to: '/careers', label: 'Careers', icon: Briefcase, mobile: true },
  { to: '/import', label: 'Import', icon: Upload, mobile: false },
  { to: '/settings', label: 'Settings', icon: Settings, mobile: false },
]
