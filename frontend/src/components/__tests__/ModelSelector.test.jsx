/**
 * Unit Tests for ModelSelector Component
 * Tests specific functionality and edge cases
 * Requirements: 1.1, 1.2
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ModelSelector from '../ModelSelector'

describe('ModelSelector', () => {
  const mockModels = [
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      provider: 'openai',
      context_window: 128000,
      input_price: 2.50,
      output_price: 10.00,
      description: 'Flagship model'
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      provider: 'openai',
      context_window: 128000,
      input_price: 0.15,
      output_price: 0.60,
      description: 'Cost-effective model'
    },
    {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      provider: 'openai',
      context_window: 128000,
      input_price: 10.00,
      output_price: 30.00,
      description: 'Previous generation'
    }
  ]

  const defaultProps = {
    provider: 'openai',
    selectedModel: 'gpt-4o',
    availableModels: mockModels,
    onModelChange: vi.fn(),
    isCustom: false,
    onToggleCustom: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering with predefined models', () => {
    it('should render component with predefined models dropdown', () => {
      render(<ModelSelector {...defaultProps} />)
      
      expect(screen.getByText('AI Model')).toBeInTheDocument()
      expect(screen.getByRole('combobox')).toBeInTheDocument()
      expect(screen.getByText('Use Custom')).toBeInTheDocument()
    })

    it('should display all available models in dropdown', () => {
      render(<ModelSelector {...defaultProps} />)
      
      const select = screen.getByRole('combobox')
      const options = select.querySelectorAll('option')
      
      expect(options).toHaveLength(3)
      expect(options[0].textContent).toBe('GPT-4o')
      expect(options[1].textContent).toBe('GPT-4o Mini')
      expect(options[2].textContent).toBe('GPT-4 Turbo')
    })

    it('should show selected model in dropdown', () => {
      render(<ModelSelector {...defaultProps} selectedModel="gpt-4o-mini" />)
      
      const select = screen.getByRole('combobox')
      expect(select.value).toBe('gpt-4o-mini')
    })

    it('should handle empty model list', () => {
      render(<ModelSelector {...defaultProps} availableModels={[]} />)
      
      expect(screen.getByText('No models available')).toBeInTheDocument()
    })
  })

  describe('Toggle between predefined and custom', () => {
    it('should call onToggleCustom when "Use Custom" is clicked', () => {
      const onToggleCustom = vi.fn()
      render(<ModelSelector {...defaultProps} onToggleCustom={onToggleCustom} />)
      
      const toggleButton = screen.getByText('Use Custom')
      fireEvent.click(toggleButton)
      
      expect(onToggleCustom).toHaveBeenCalledTimes(1)
    })

    it('should show "Use Predefined" button when in custom mode', () => {
      render(<ModelSelector {...defaultProps} isCustom={true} />)
      
      expect(screen.getByText('Use Predefined')).toBeInTheDocument()
      expect(screen.queryByText('Use Custom')).not.toBeInTheDocument()
    })

    it('should call onToggleCustom when "Use Predefined" is clicked', () => {
      const onToggleCustom = vi.fn()
      render(<ModelSelector {...defaultProps} isCustom={true} onToggleCustom={onToggleCustom} />)
      
      const toggleButton = screen.getByText('Use Predefined')
      fireEvent.click(toggleButton)
      
      expect(onToggleCustom).toHaveBeenCalledTimes(1)
    })
  })

  describe('Custom input mode', () => {
    it('should display custom input field when isCustom is true', () => {
      render(<ModelSelector {...defaultProps} isCustom={true} />)
      
      const input = screen.getByPlaceholderText(/Enter custom .* model name/)
      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute('type', 'text')
    })

    it('should not display dropdown when in custom mode', () => {
      render(<ModelSelector {...defaultProps} isCustom={true} />)
      
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    })

    it('should show correct placeholder for provider', () => {
      render(<ModelSelector {...defaultProps} provider="anthropic" isCustom={true} />)
      
      expect(screen.getByPlaceholderText('Enter custom anthropic model name')).toBeInTheDocument()
    })

    it('should display current model value in custom input', () => {
      render(<ModelSelector {...defaultProps} isCustom={true} selectedModel="custom-model-123" />)
      
      const input = screen.getByPlaceholderText(/Enter custom .* model name/)
      expect(input.value).toBe('custom-model-123')
    })
  })

  describe('Model selection callbacks', () => {
    it('should call onModelChange when predefined model is selected', () => {
      const onModelChange = vi.fn()
      render(<ModelSelector {...defaultProps} onModelChange={onModelChange} />)
      
      const select = screen.getByRole('combobox')
      fireEvent.change(select, { target: { value: 'gpt-4-turbo' } })
      
      expect(onModelChange).toHaveBeenCalledWith('gpt-4-turbo')
    })

    it('should call onModelChange when custom input changes', () => {
      const onModelChange = vi.fn()
      render(<ModelSelector {...defaultProps} isCustom={true} onModelChange={onModelChange} />)
      
      const input = screen.getByPlaceholderText(/Enter custom .* model name/)
      fireEvent.change(input, { target: { value: 'my-custom-model' } })
      
      expect(onModelChange).toHaveBeenCalledWith('my-custom-model')
    })

    it('should call onModelChange multiple times as user types', () => {
      const onModelChange = vi.fn()
      render(<ModelSelector {...defaultProps} isCustom={true} onModelChange={onModelChange} />)
      
      const input = screen.getByPlaceholderText(/Enter custom .* model name/)
      
      fireEvent.change(input, { target: { value: 'c' } })
      fireEvent.change(input, { target: { value: 'cu' } })
      fireEvent.change(input, { target: { value: 'cus' } })
      
      expect(onModelChange).toHaveBeenCalledTimes(3)
      expect(onModelChange).toHaveBeenLastCalledWith('cus')
    })
  })

  describe('Edge cases', () => {
    it('should handle switching from custom to predefined with invalid model', () => {
      const onModelChange = vi.fn()
      const onToggleCustom = vi.fn()
      
      render(
        <ModelSelector 
          {...defaultProps} 
          isCustom={true} 
          selectedModel="invalid-custom-model"
          onModelChange={onModelChange}
          onToggleCustom={onToggleCustom}
        />
      )
      
      const toggleButton = screen.getByText('Use Predefined')
      fireEvent.click(toggleButton)
      
      expect(onToggleCustom).toHaveBeenCalled()
      // Should reset to first available model
      expect(onModelChange).toHaveBeenCalledWith('gpt-4o')
    })

    it('should preserve custom value when toggling to custom mode', () => {
      const { rerender } = render(<ModelSelector {...defaultProps} selectedModel="gpt-4o" />)
      
      // Toggle to custom mode
      rerender(<ModelSelector {...defaultProps} isCustom={true} selectedModel="gpt-4o" />)
      
      const input = screen.getByPlaceholderText(/Enter custom .* model name/)
      expect(input.value).toBe('gpt-4o')
    })

    it('should handle empty string in custom input', () => {
      const onModelChange = vi.fn()
      render(<ModelSelector {...defaultProps} isCustom={true} onModelChange={onModelChange} />)
      
      const input = screen.getByPlaceholderText(/Enter custom .* model name/)
      fireEvent.change(input, { target: { value: '' } })
      
      expect(onModelChange).toHaveBeenCalledWith('')
    })
  })

  describe('Format examples display - Requirements 5.1, 5.2, 5.3, 5.4, 5.5', () => {
    it('should display format examples when in custom mode', () => {
      render(<ModelSelector {...defaultProps} isCustom={true} provider="openai" />)
      
      expect(screen.getByText(/Format Examples for/i)).toBeInTheDocument()
    })

    it('should NOT display format examples when in predefined mode', () => {
      render(<ModelSelector {...defaultProps} isCustom={false} provider="openai" />)
      
      expect(screen.queryByText(/Format Examples for/i)).not.toBeInTheDocument()
    })

    it('should display format examples for Anthropic provider', () => {
      render(<ModelSelector {...defaultProps} isCustom={true} provider="anthropic" />)
      
      expect(screen.getByText('claude-sonnet-5')).toBeInTheDocument()
    })

    it('should display format examples for Gemini provider', () => {
      render(<ModelSelector {...defaultProps} isCustom={true} provider="gemini" />)
      
      expect(screen.getByText('gemini-2.5-flash')).toBeInTheDocument()
    })

    it('should display documentation link in custom mode', () => {
      render(<ModelSelector {...defaultProps} isCustom={true} provider="openai" />)
      
      const link = screen.getByRole('link', { name: /View .* model documentation/i })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('target', '_blank')
    })
  })

  describe('Warning message display - Requirement 3.3', () => {
    it('should display warning message when in custom mode', () => {
      render(<ModelSelector {...defaultProps} isCustom={true} provider="openai" />)
      
      expect(screen.getByText('Custom Model Notice')).toBeInTheDocument()
    })

    it('should NOT display warning when in predefined mode', () => {
      render(<ModelSelector {...defaultProps} isCustom={false} provider="openai" />)
      
      expect(screen.queryByText('Custom Model Notice')).not.toBeInTheDocument()
    })

    it('should display warning with provider name', () => {
      render(<ModelSelector {...defaultProps} isCustom={true} provider="anthropic" />)
      
      expect(screen.getByText(/sent directly to Anthropic/i)).toBeInTheDocument()
    })

    it('should mention lack of validation in warning', () => {
      render(<ModelSelector {...defaultProps} isCustom={true} provider="openai" />)
      
      expect(screen.getByText(/without validation/i)).toBeInTheDocument()
    })

    it('should expose the custom-model notice to screen readers', () => {
      const { container } = render(<ModelSelector {...defaultProps} isCustom={true} provider="openai" />)

      // role="note", not "alert": the notice is always present in custom mode, so
      // role="alert" is reserved for the validation error below the input.
      expect(container.querySelectorAll('[role="note"]').length).toBeGreaterThan(0)
      expect(container.querySelectorAll('[role="alert"]').length).toBe(0)
    })
  })
})
