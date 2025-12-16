/**
 * Property-Based Tests for ModelSelector Component
 * Feature: custom-model-input, Property 1: Custom model toggle displays input field
 * Validates: Requirements 1.2
 * 
 * Property 1: Custom model toggle displays input field
 * For any UI state where the user toggles to custom model mode, the rendered component
 * should contain a text input field for model entry.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ModelSelector from '../ModelSelector'

describe('Property 1: Custom model toggle displays input field', () => {
  const mockModels = [
    {
      id: 'model-1',
      name: 'Model 1',
      provider: 'openai',
      context_window: 128000,
      input_price: 2.50,
      output_price: 10.00
    },
    {
      id: 'model-2',
      name: 'Model 2',
      provider: 'openai',
      context_window: 128000,
      input_price: 0.15,
      output_price: 0.60
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should display text input field when toggled to custom mode from predefined', () => {
    // Property: For any UI state where the user toggles to custom model mode,
    // the rendered component should contain a text input field for model entry
    
    const onToggleCustom = vi.fn()
    const onModelChange = vi.fn()
    
    // Start in predefined mode
    const { rerender } = render(
      <ModelSelector
        provider="openai"
        selectedModel="model-1"
        availableModels={mockModels}
        onModelChange={onModelChange}
        isCustom={false}
        onToggleCustom={onToggleCustom}
      />
    )

    // Verify we're in predefined mode (dropdown visible)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/Enter custom/)).not.toBeInTheDocument()

    // Click toggle to switch to custom mode
    const toggleButton = screen.getByText('Use Custom')
    fireEvent.click(toggleButton)
    expect(onToggleCustom).toHaveBeenCalled()

    // Rerender with isCustom=true to simulate state change
    rerender(
      <ModelSelector
        provider="openai"
        selectedModel="model-1"
        availableModels={mockModels}
        onModelChange={onModelChange}
        isCustom={true}
        onToggleCustom={onToggleCustom}
      />
    )

    // Verify text input field is now displayed
    const customInput = screen.getByPlaceholderText(/Enter custom .* model name/)
    expect(customInput).toBeInTheDocument()
    expect(customInput).toHaveAttribute('type', 'text')
    
    // Verify dropdown is no longer visible
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('should display text input field when initially rendered in custom mode', () => {
    // Property: Component should display input field when isCustom is true,
    // regardless of how it got into that state
    
    render(
      <ModelSelector
        provider="anthropic"
        selectedModel="custom-model-xyz"
        availableModels={mockModels}
        onModelChange={vi.fn()}
        isCustom={true}
        onToggleCustom={vi.fn()}
      />
    )

    // Verify text input field is displayed
    const customInput = screen.getByPlaceholderText(/Enter custom .* model name/)
    expect(customInput).toBeInTheDocument()
    expect(customInput).toHaveAttribute('type', 'text')
    
    // Verify dropdown is not visible
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('should display text input field for any provider when in custom mode', () => {
    // Property: Custom input field should be available for all providers
    
    const providers = ['openai', 'anthropic', 'gemini']
    
    providers.forEach(provider => {
      const { unmount } = render(
        <ModelSelector
          provider={provider}
          selectedModel="custom-model"
          availableModels={mockModels}
          onModelChange={vi.fn()}
          isCustom={true}
          onToggleCustom={vi.fn()}
        />
      )

      // Verify text input field is displayed for this provider
      const customInput = screen.getByPlaceholderText(new RegExp(`Enter custom ${provider} model name`))
      expect(customInput).toBeInTheDocument()
      expect(customInput).toHaveAttribute('type', 'text')
      
      unmount()
    })
  })

  it('should allow text entry in custom input field', () => {
    // Property: Custom input field should be functional and accept text input
    
    const onModelChange = vi.fn()
    
    render(
      <ModelSelector
        provider="openai"
        selectedModel=""
        availableModels={mockModels}
        onModelChange={onModelChange}
        isCustom={true}
        onToggleCustom={vi.fn()}
      />
    )

    const customInput = screen.getByPlaceholderText(/Enter custom .* model name/)
    
    // Verify input is editable
    expect(customInput).not.toBeDisabled()
    expect(customInput).not.toHaveAttribute('readonly')
    
    // Type into the input
    fireEvent.change(customInput, { target: { value: 'my-custom-model' } })
    
    // Verify the change was registered
    expect(onModelChange).toHaveBeenCalledWith('my-custom-model')
    expect(customInput.value).toBe('my-custom-model')
  })

  it('should maintain input field when toggling back and forth', () => {
    // Property: Toggling to custom mode should consistently display input field
    
    const onToggleCustom = vi.fn()
    
    const { rerender } = render(
      <ModelSelector
        provider="openai"
        selectedModel="model-1"
        availableModels={mockModels}
        onModelChange={vi.fn()}
        isCustom={false}
        onToggleCustom={onToggleCustom}
      />
    )

    // Toggle to custom
    fireEvent.click(screen.getByText('Use Custom'))
    rerender(
      <ModelSelector
        provider="openai"
        selectedModel="model-1"
        availableModels={mockModels}
        onModelChange={vi.fn()}
        isCustom={true}
        onToggleCustom={onToggleCustom}
      />
    )
    
    expect(screen.getByPlaceholderText(/Enter custom/)).toBeInTheDocument()

    // Toggle back to predefined
    fireEvent.click(screen.getByText('Use Predefined'))
    rerender(
      <ModelSelector
        provider="openai"
        selectedModel="model-1"
        availableModels={mockModels}
        onModelChange={vi.fn()}
        isCustom={false}
        onToggleCustom={onToggleCustom}
      />
    )
    
    expect(screen.queryByPlaceholderText(/Enter custom/)).not.toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()

    // Toggle to custom again
    fireEvent.click(screen.getByText('Use Custom'))
    rerender(
      <ModelSelector
        provider="openai"
        selectedModel="model-1"
        availableModels={mockModels}
        onModelChange={vi.fn()}
        isCustom={true}
        onToggleCustom={onToggleCustom}
      />
    )
    
    // Input field should be displayed again
    expect(screen.getByPlaceholderText(/Enter custom/)).toBeInTheDocument()
  })

  it('should display input field with empty models list in custom mode', () => {
    // Property: Custom input should work even when no predefined models are available
    
    render(
      <ModelSelector
        provider="openai"
        selectedModel=""
        availableModels={[]}
        onModelChange={vi.fn()}
        isCustom={true}
        onToggleCustom={vi.fn()}
      />
    )

    // Verify text input field is still displayed
    const customInput = screen.getByPlaceholderText(/Enter custom .* model name/)
    expect(customInput).toBeInTheDocument()
    expect(customInput).toHaveAttribute('type', 'text')
  })
})
