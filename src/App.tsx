import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Careers } from './pages/Careers'
import { Dashboard } from './pages/Dashboard'
import { Scouting } from './pages/Scouting'
import { Achievements, Import, NotFound, SettingsPage } from './pages/Simple'
import { Squad } from './pages/Squad'
import { Staff } from './pages/Staff'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="squad" element={<Squad />} />
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
