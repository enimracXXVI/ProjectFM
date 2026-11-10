import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Splash } from './components/Splash'
import { ErrorText } from './components/form'
import { useAuth } from './lib/auth'
import { useCareer } from './lib/career'
import { CareerForm } from './pages/CareerForm'
import { Careers } from './pages/Careers'
import { Dashboard } from './pages/Dashboard'
import { Import } from './pages/Import'
import { Login } from './pages/Login'
import { PlayerDetail } from './pages/PlayerDetail'
import { Scouting } from './pages/Scouting'
import { SettingsPage } from './pages/Settings'
import { Achievements, NotFound } from './pages/Simple'
import { Squad } from './pages/Squad'
import { Staff } from './pages/Staff'

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
        <Route path="scouting" element={<Scouting />} />
        <Route path="achievements" element={<Achievements />} />
        <Route path="careers" element={<Careers />} />
        <Route path="import" element={<Import />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

function FirstCareer() {
  return (
    <div className="pt-safe mx-auto grid min-h-full max-w-xl content-center gap-4 px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Create your first career</h1>
      <p className="text-muted text-sm">
        One career per FM save. You can add more later and switch between them.
      </p>
      <CareerForm />
    </div>
  )
}
