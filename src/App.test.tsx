import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from './App'
import { CareerProvider } from './lib/career'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CareerProvider>
        <App />
      </CareerProvider>
    </MemoryRouter>,
  )
}

describe('App', () => {
  it('renders the dashboard for the current career', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { level: 1, name: 'Sample FC' })).toBeInTheDocument()
  })

  it('switches career from the top bar', async () => {
    renderAt('/')
    await userEvent.selectOptions(screen.getByLabelText('Current career'), 'c2')
    expect(screen.getByRole('heading', { level: 1, name: 'Example United' })).toBeInTheDocument()
  })

  it('shows not found for unknown routes', () => {
    renderAt('/nope')
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })
})
