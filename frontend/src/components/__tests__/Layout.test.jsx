import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import Layout from '../Layout'

vi.mock('../../context/useTheme', () => ({ useTheme: () => ({ theme: 'light', setTheme: vi.fn() }) }))
vi.mock('../SearchModal', () => ({ default: ({ isOpen }) => isOpen ? <p>Search open</p> : null }))
it('keeps Notebooks, Settings and Search in desktop and mobile navigation', () => {
  render(<MemoryRouter><Layout><p>Content</p></Layout></MemoryRouter>)
  expect(screen.getByRole('link', { name: 'Notebooks' })).toHaveAttribute('href', '/')
  expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings')
  for (const name of ['Decks', 'Progress', 'Add material']) expect(screen.queryByRole('link', { name })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  expect(screen.getByText('Search open')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
  const mobile = document.getElementById('mobile-navigation')
  expect(within(mobile).getAllByRole('link')).toHaveLength(2)
  expect(within(mobile).getByRole('link', { name: 'Notebooks' })).toHaveAttribute('href', '/')
  expect(within(mobile).getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings')
})
