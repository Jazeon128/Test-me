import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Spinner from '../Spinner'

describe('Spinner', () => {
  it('has the status role', () => {
    render(<Spinner />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('defaults to the accessible name Loading', () => {
    render(<Spinner />)
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  })

  it('uses a custom accessible name', () => {
    render(<Spinner aria-label="Loading settings" />)
    expect(screen.getByRole('status', { name: 'Loading settings' })).toBeInTheDocument()
  })
})
