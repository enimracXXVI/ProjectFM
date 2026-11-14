import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { Career } from './data/db'
import { ConfirmProvider } from './components/ConfirmDialog'
import { CareerProvider } from './lib/career'

const auth = vi.hoisted(() => ({ session: null as object | null, loading: false }))
const api = vi.hoisted(() => ({ careers: [] as Career[] }))

vi.mock('./lib/auth', () => ({ useAuth: () => auth }))
vi.mock('./data/api', () => ({
  listCareers: async () => api.careers,
  listPlayers: async () => [],
  listImports: async () => [],
  createCareer: vi.fn(),
  isMissingTable: () => false,
}))
vi.mock('./data/notes', async (orig) => ({
  ...(await orig<typeof import('./data/notes')>()),
  listNotes: async () => [],
}))

const career = (id: string, club: string): Career => ({
  id,
  name: `Career ${id}`,
  club,
  nation: null,
  start_season: '2026/27',
  current_season: '2026/27',
  notes: null,
  crest_url: null,
  kit_home_url: null,
  kit_away_url: null,
  kit_third_url: null,
  scouting: {},
  created_at: '',
})

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <CareerProvider>
          <ConfirmProvider>
            <App />
          </ConfirmProvider>
        </CareerProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('App', () => {
  beforeEach(() => {
    auth.session = { user: { email: 'me@example.com' } }
    api.careers = [career('a', 'Fiorentina'), career('b', 'Empoli')]
    localStorage.clear()
  })

  it('shows the login screen when signed out', () => {
    auth.session = null
    renderAt('/')
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('asks to create a career when there are none', async () => {
    api.careers = []
    renderAt('/')
    expect(
      await screen.findByRole('heading', { name: 'Create your first career' }),
    ).toBeInTheDocument()
  })

  it('renders the dashboard and switches career', async () => {
    renderAt('/')
    expect(await screen.findByRole('heading', { level: 1, name: 'Fiorentina' })).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Current career'), 'b')
    expect(screen.getByRole('heading', { level: 1, name: 'Empoli' })).toBeInTheDocument()
  })

  it('shows not found for unknown routes', async () => {
    renderAt('/nope')
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })

  it.each([
    ['/settings/instructions', 'Team instructions', 'Tempo'],
    ['/settings/player-instructions', 'Player instructions', 'Dribbling frequency'],
    ['/settings/fm-codes', 'FM codes', 'Mentalities'],
    ['/settings/tactics', 'Tactics', 'Briefing'],
    ['/settings/role-warnings', 'Role warnings', 'Out of possession: this many Pressing roles.'],
  ])('shows the %s settings', async (path, title, item) => {
    renderAt(path)
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument()
    expect(screen.getAllByText(item).length).toBeGreaterThan(0)
  })
})
