/**
 * Unit Tests for FormatExamples Component
 * Tests provider-specific examples and documentation links
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import FormatExamples from '../FormatExamples'

describe('FormatExamples', () => {
  describe('Anthropic provider', () => {
    it('should display correct examples for Anthropic', () => {
      render(<FormatExamples provider="anthropic" />)
      
      expect(screen.getByText('Format Examples for Anthropic')).toBeInTheDocument()
      expect(screen.getByText('claude-3-5-sonnet-20241022')).toBeInTheDocument()
      expect(screen.getByText('claude-3-5-haiku-20241022')).toBeInTheDocument()
      expect(screen.getByText('claude-3-opus-20240229')).toBeInTheDocument()
    })

    it('should display correct documentation link for Anthropic', () => {
      render(<FormatExamples provider="anthropic" />)
      
      const link = screen.getByRole('link', { name: /View Anthropic model documentation/i })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', 'https://docs.anthropic.com/en/docs/about-claude/models')
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })
  })

  describe('OpenAI provider', () => {
    it('should display correct examples for OpenAI', () => {
      render(<FormatExamples provider="openai" />)
      
      expect(screen.getByText('Format Examples for Openai')).toBeInTheDocument()
      expect(screen.getByText('gpt-4o')).toBeInTheDocument()
      expect(screen.getByText('gpt-4-turbo')).toBeInTheDocument()
      expect(screen.getByText('gpt-4o-mini')).toBeInTheDocument()
    })

    it('should display correct documentation link for OpenAI', () => {
      render(<FormatExamples provider="openai" />)
      
      const link = screen.getByRole('link', { name: /View Openai model documentation/i })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', 'https://platform.openai.com/docs/models')
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })
  })

  describe('Gemini provider', () => {
    it('should display correct examples for Gemini', () => {
      render(<FormatExamples provider="gemini" />)
      
      expect(screen.getByText('Format Examples for Gemini')).toBeInTheDocument()
      expect(screen.getByText('gemini-2.5-flash')).toBeInTheDocument()
      expect(screen.getByText('gemini-3-pro-preview')).toBeInTheDocument()
      expect(screen.getByText('gemini-2.5-pro')).toBeInTheDocument()
    })

    it('should display correct documentation link for Gemini', () => {
      render(<FormatExamples provider="gemini" />)
      
      const link = screen.getByRole('link', { name: /View Gemini model documentation/i })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', 'https://ai.google.dev/gemini-api/docs/models/gemini')
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })
  })

  describe('Invalid provider', () => {
    it('should render nothing for invalid provider', () => {
      const { container } = render(<FormatExamples provider="invalid" />)
      
      expect(container.firstChild).toBeNull()
    })

    it('should render nothing for undefined provider', () => {
      const { container } = render(<FormatExamples provider={undefined} />)
      
      expect(container.firstChild).toBeNull()
    })
  })

  describe('Visual elements', () => {
    it('should display info icon', () => {
      const { container } = render(<FormatExamples provider="openai" />)
      
      // Check for SVG icon (lucide-react renders SVG)
      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })

    it('should display examples in code blocks', () => {
      render(<FormatExamples provider="openai" />)
      
      const codeBlocks = screen.getAllByText(/gpt-/)
      codeBlocks.forEach(block => {
        expect(block.tagName).toBe('CODE')
      })
    })

    it('should display external link icon', () => {
      const { container } = render(<FormatExamples provider="openai" />)
      
      // Check for multiple SVG icons (info + external link)
      const svgs = container.querySelectorAll('svg')
      expect(svgs.length).toBeGreaterThan(1)
    })
  })
})
