import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ChatMessage from '../ChatMessage'

const citation = n => ({ n, display_name: 'Research.pdf', locator: 'Page 4', excerpt: 'Retrieval helps recall.' })
const assistant = content => ({ role: 'assistant', content, citations: [citation(2), citation(3), citation(5)] })

describe('Chat message', () => {
  it('groups star, dot, indented and dash bullets into one unordered list', () => {
    const { container } = render(<ChatMessage message={assistant('* First\n• Second\n  * Third\n- Fourth\n  • Fifth\n  - Sixth')} />)
    const list = screen.getByRole('list')
    expect(list.tagName).toBe('UL')
    expect(within(list).getAllByRole('listitem').map(item => item.textContent)).toEqual([
      'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth',
    ])
    expect(container.querySelectorAll('ul')).toHaveLength(1)
  })

  it('renders bold text and an adjacent citation chip', () => {
    render(<ChatMessage message={assistant('**Bold:** text [3]')} />)
    expect(screen.getByText('Bold:', { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Citation 3: Research.pdf, Page 4' })).toBeInTheDocument()
    expect(screen.getByRole('article')).toHaveTextContent('Bold: text 3')
  })

  it('renders grouped citations inside bold text and citations directly next to it', () => {
    const { container } = render(<ChatMessage message={assistant('**Evidence [2, 5]**[3] and **Recall**')} />)
    const strong = container.querySelector('strong')
    expect(within(strong).getAllByRole('button')).toHaveLength(2)
    expect(within(strong).getByRole('button', { name: 'Citation 2: Research.pdf, Page 4' })).toBeInTheDocument()
    expect(within(strong).getByRole('button', { name: 'Citation 5: Research.pdf, Page 4' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Citation 3: Research.pdf, Page 4' })).toBeInTheDocument()
    expect(screen.getByText('Recall', { selector: 'strong' })).toBeInTheDocument()
  })

  it('keeps unmatched bold markers literal while still rendering citations', () => {
    const { container } = render(<ChatMessage message={assistant('**Unmatched text [3]')} />)
    expect(screen.getByRole('article')).toHaveTextContent('**Unmatched text 3')
    expect(container.querySelector('strong')).toBeNull()
    expect(screen.getByRole('button', { name: 'Citation 3: Research.pdf, Page 4' })).toBeInTheDocument()
  })

  it('keeps user markdown and citation markers as plain text', () => {
    const content = '**x**\n* y\n- z\n1. numbered [3]'
    const { container } = render(<ChatMessage message={{ role: 'user', content, citations: [citation(3)] }} />)
    expect(container.querySelector('p').textContent).toBe(content)
    expect(container.querySelector('strong')).toBeNull()
    expect(container.querySelector('li')).toBeNull()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('preserves numbered lists and treats unsupported markdown and HTML as text', () => {
    const { container } = render(<ChatMessage message={assistant('1. First\n2. **Second**\n\n# Heading\n*italic* [link](url) <img src="x"> `code`')} />)
    expect(screen.getByRole('list').tagName).toBe('OL')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText('Second', { selector: 'strong' })).toBeInTheDocument()
    expect(container.querySelector('p').textContent).toBe('# Heading\n*italic* [link](url) <img src="x"> `code`')
    expect(container.querySelector('h1, em, a, img, code')).toBeNull()
  })
})
