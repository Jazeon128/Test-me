/**
 * Unit Tests for CustomModelWarning Component
 * Tests warning message display for custom models
 * Requirements: 3.3
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import CustomModelWarning from '../CustomModelWarning'

describe('CustomModelWarning', () => {
  describe('Warning message display - Requirement 3.3', () => {
    it('should render warning message for custom models', () => {
      render(<CustomModelWarning provider="openai" />)
      
      expect(screen.getByText('Custom Model Notice')).toBeInTheDocument()
      expect(screen.getByText(/This custom model name will be sent directly to/i)).toBeInTheDocument()
    })

    it('should display provider name in warning message', () => {
      render(<CustomModelWarning provider="anthropic" />)
      
      expect(screen.getByText(/sent directly to Anthropic/i)).toBeInTheDocument()
    })

    it('should capitalize provider name correctly', () => {
      render(<CustomModelWarning provider="gemini" />)
      
      expect(screen.getByText(/sent directly to Gemini/i)).toBeInTheDocument()
    })

    it('should mention validation in warning text', () => {
      render(<CustomModelWarning provider="openai" />)
      
      expect(screen.getByText(/without validation/i)).toBeInTheDocument()
    })

    it('should advise user to ensure model name is correct', () => {
      render(<CustomModelWarning provider="openai" />)
      
      expect(screen.getByText(/Please ensure the model name is correct/i)).toBeInTheDocument()
    })
  })

  describe('Accessibility - Requirement 3.3', () => {
    it('should have role="alert" for screen readers', () => {
      const { container } = render(<CustomModelWarning provider="openai" />)
      
      const alertElement = container.querySelector('[role="alert"]')
      expect(alertElement).toBeInTheDocument()
    })

    it('should have aria-live="polite" for dynamic updates', () => {
      const { container } = render(<CustomModelWarning provider="openai" />)
      
      const alertElement = container.querySelector('[aria-live="polite"]')
      expect(alertElement).toBeInTheDocument()
    })

    it('should display warning icon', () => {
      const { container } = render(<CustomModelWarning provider="openai" />)
      
      // Check for AlertTriangle icon (lucide-react renders as svg)
      const icon = container.querySelector('svg')
      expect(icon).toBeInTheDocument()
    })
  })

  describe('Styling - Requirement 3.3: Subtle, not alarming', () => {
    it('should use amber/yellow color scheme (not red)', () => {
      const { container } = render(<CustomModelWarning provider="openai" />)
      
      const warningDiv = container.querySelector('[role="alert"]')
      // Check for amber classes (subtle warning color)
      expect(warningDiv.className).toMatch(/amber/)
      expect(warningDiv.className).not.toMatch(/red/)
    })

    it('should have appropriate padding and spacing', () => {
      const { container } = render(<CustomModelWarning provider="openai" />)
      
      const warningDiv = container.querySelector('[role="alert"]')
      expect(warningDiv.className).toMatch(/p-3/)
      expect(warningDiv.className).toMatch(/rounded-lg/)
    })
  })
})
