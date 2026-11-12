import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Splash } from './components/Splash'
import { ErrorText } from './components/form'
import { useAuth } from './lib/auth'
import { useCareer } from './lib/career'
import { CareerForm } from './pages/CareerForm'
import { Careers } from './pages/Careers'
import { Compare } from './pages/Compare'
import { Dashboard } from './pages/Dashboard'
import { Development } from './pages/Development'
import { Import } from './pages/Import'
import { Login } from './pages/Login'
import { PlayerDetail } from './pages/PlayerDetail'
import { Scouting } from './pages/Scouting'
import { ScoutingRegion } from './pages/ScoutingRegion'
import { StaffEdit } from './pages/StaffEdit'
import { SettingsPage } from './pages/Settings'
import { AttributesSettings } from './pages/settings/Attributes'
import { ColumnsSettings } from './pages/settings/Columns'
import { RegionsSettings } from './pages/settings/Regions'
import { RoleWeightsSettings } from './pages/settings/RoleWeights'
import { RolesSettings } from './pages/settings/Roles'
import { StaffRatingsSettings } from './pages/settings/StaffRatings'
import { LayoutSettings } from './pages/settings/Layout'
import { StatusesSettings } from './pages/settings/Statuses'
import { NotFound } from './pages/Simple'
import { Achievements } from './pages/Achievements'
import { Check } from './pages/Check'
import { Competition } from './pages/Competition'
import { Competitions } from './pages/Competitions'
import { Match } from './pages/Match'
import { Tactics } from './pages/Tactics'
import { BottomBarSettings } from './pages/settings/BottomBar'
import { NamesSettings } from './pages/settings/Names'
import { PersonalitySettings } from './pages/settings/Personality'
import { InstructionsSettings } from './pages/settings/Instructions'
import { StaffAttributesSettings } from './pages/settings/StaffAttributes'
import { Explain } from './pages/Explain'
import { Squad } from './pages/Squad'
import { Staff } from './pages/Staff'
import { World } from './pages/World'
import { WorldPlayer } from './pages/WorldPlayer'

export default function App() {
  const { session, loading } = useAuth()
  if (loading) return <Splash />
  if (!session) return <Login />
  return <SignedIn />
}

function SignedIn() {
  const { current, loading, error } = useCareer()
  if (loading) return <Splash message="Loading careers…" />
  if (error)
    return (
      <div className="grid h-full place-items-center px-4">
        <ErrorText error={error} />
      </div>
    )
  if (!current) return <FirstCareer />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="squad" element={<Squad />} />
        <Route path="squad/:id" element={<PlayerDetail />} />
        <Route path="staff" element={<Staff />} />
        <Route path="development" element={<Development />} />
        <Route path="compare" element={<Compare />} />
        <Route path="world" element={<World />} />
        <Route path="world/:id" element={<WorldPlayer />} />
        <Route path="staff/:id" element={<StaffEdit />} />
        <Route path="scouting" element={<Scouting />} />
        <Route path="scouting/:regionId" element={<ScoutingRegion />} />
        <Route path="achievements" element={<Achievements />} />
        <Route path="careers" element={<Careers />} />
        <Route path="import" element={<Import />} />
        <Route path="check" element={<Check />} />
        <Route path="competitions" element={<Competitions />} />
        <Route path="tactics" element={<Tactics />} />
        <Route path="competitions/:dbId" element={<Competition />} />
        <Route path="competitions/:dbId/match/:key" element={<Match />} />
        <Route path="explain" element={<Explain />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="settings/statuses" element={<StatusesSettings />} />
        <Route path="settings/attributes" element={<AttributesSettings />} />
        <Route path="settings/layout" element={<LayoutSettings />} />
        <Route path="settings/columns" element={<ColumnsSettings />} />
        <Route path="settings/regions" element={<RegionsSettings />} />
        <Route path="settings/roles" element={<RolesSettings />} />
        <Route path="settings/role-weights" element={<RoleWeightsSettings />} />
        <Route path="settings/staff-ratings" element={<StaffRatingsSettings />} />
        <Route path="settings/bottom-bar" element={<BottomBarSettings />} />
        <Route path="settings/staff-attributes" element={<StaffAttributesSettings />} />
        <Route path="settings/names" element={<NamesSettings />} />
        <Route path="settings/personality" element={<PersonalitySettings />} />
        <Route path="settings/instructions" element={<InstructionsSettings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

function FirstCareer() {
  return (
    <div className="mx-auto grid min-h-full max-w-xl content-center gap-4 px-4 py-8 pt-safe">
      <h1 className="text-2xl font-bold tracking-tight">Create your first career</h1>
      <p className="text-sm text-muted">
        One career per FM save. You can add more later and switch between them.
      </p>
      <CareerForm />
    </div>
  )
}
