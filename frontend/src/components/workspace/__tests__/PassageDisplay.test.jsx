import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import CitationChip from '../CitationChip'
import NodePanel from '../../../canvas/NodePanel'
import { TemplateBadge } from '../../../canvas/CanvasChrome'

vi.mock('../../../services/api', () => ({ canvasAPI: {
  savedQuestionsForNode: vi.fn().mockResolvedValue({ data: { questions: [], held_back: 0 } }),
} }))
const text = 'ol, custom dependencies, or GPU acceleration AWS Lambda Category Details...'
const formatted = '… custom dependencies, or GPU acceleration AWS Lambda Category Details...'

it('shows citation heading, Page n and formatted passage', () => {
  render(<CitationChip citation={{ n: 1, display_name: 'Lambda.pdf', heading: 'Compute', page: 3,
    locator: 'Section 2', excerpt: text }} />)
  fireEvent.click(screen.getByRole('button', { name: 'Citation 1: Lambda.pdf, Section 2' }))
  expect(screen.getByText('Compute').tagName).toBe('STRONG')
  expect(screen.getByText('Page 3')).toBeInTheDocument()
  expect(screen.getByText(formatted)).toBeInTheDocument()
  expect(screen.queryByText(text)).not.toBeInTheDocument()
})

it('shows node heading, Page n and formatted passage', async () => {
  render(<MemoryRouter><NodePanel canvasId={7} node={{ id: 'n', data: { label: 'Lambda' } }}
    source={{ section: { heading: 'Compute', page: 3, text } }} onClose={vi.fn()} /></MemoryRouter>)
  expect(screen.getByText('Compute').tagName).toBe('STRONG')
  expect(screen.getByText('Page 3')).toBeInTheDocument()
  expect(screen.getByText(formatted)).toBeInTheDocument()
  expect(screen.queryByText(text)).not.toBeInTheDocument()
  await screen.findByRole('button', { name: 'Test me on this' })
})

it.each([false, true])('uses a plain template label with chosen_by_user=%s', chosen => {
  const { container } = render(<TemplateBadge canvas={{ template: 'comparison_matrix',
    template_title: 'Comparison matrix', routing_confidence: 0.81, chosen_by_user: chosen }} />)
  expect(screen.getByText('Drawn as: Comparison matrix')).toBeInTheDocument()
  expect(container.textContent).not.toContain('%')
  expect(container.firstChild).toHaveAttribute('title', chosen ? 'You chose this layout.'
    : 'Chosen from your question. Ask again to draw it another way.')
})
