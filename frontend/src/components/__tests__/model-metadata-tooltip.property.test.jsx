/**
 * Property-Based Tests for Model Metadata Tooltip Display
 * Feature: custom-model-input, Property 4: Model metadata display on hover
 * Validates: Requirements 3.2
 * 
 * Property 4: Model metadata display on hover
 * For any predefined model in the dropdown, when a hover event is simulated,
 * the DOM should contain elements displaying context window, pricing, and description.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ModelSelector from '../ModelSelector'

describe('Property 4: Model metadata display on hover', () => {
  const mockModels = [
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      provider: 'openai',
      context_window: 128000,
      input_price: 2.50,
      output_price: 10.00,
      description: 'Flagship model with high intelligence'
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      provider: 'openai',
      context_window: 64000,
      input_price: 0.15,
      output_price: 0.60,
      description: 'Cost-effective small model'
    },
    {
      id: 'claude-3-5-sonnet-20241022',
      name: 'Claude 3.5 Sonnet',
      provider: 'anthropic',
      context_window: 200000,
      input_price: 3.00,
      output_price: 15.00,
      description: 'Most intelligent model for complex reasoning'
    },
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      provider: 'gemini',
      context_window: 1048576,
      input_price: 0.075,
      output_price: 0.30,
      description: 'Fast and intelligent with thinking capabilities'
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should display context window metadata on hover for any predefined model', async () => {
    // Property: For any predefined model, hovering should display context window information
    
    for (const model of mockModels) {
      const { unmount } = render(
        <ModelSelector
          provider={model.provider}
          selectedModel={model.id}
          availableModels={[model]}
          onModelChange={vi.fn()}
          isCustom={false}
          onToggleCustom={vi.fn()}
        />
      )

      // Find the dropdown option element
      const select = screen.getByRole('combobox')
      const option = select.querySelector(`option[value="${model.id}"]`)
      expect(option).toBeInTheDocument()

      // Hover over the option
      fireEvent.mouseEnter(option)

      // Wait for tooltip to appear and verify context window is displayed
      await waitFor(() => {
        const contextWindowText = model.context_window.toLocaleString()
        expect(screen.getByText(new RegExp(contextWindowText))).toBeInTheDocument()
      })

      unmount()
    }
  })

  it('should display pricing metadata on hover for any predefined model', async () => {
    // Property: For any predefined model, hovering should display input and output pricing
    
    for (const model of mockModels) {
      const { unmount } = render(
        <ModelSelector
          provider={model.provider}
          selectedModel={model.id}
          availableModels={[model]}
          onModelChange={vi.fn()}
          isCustom={false}
          onToggleCustom={vi.fn()}
        />
      )

      const select = screen.getByRole('combobox')
      const option = select.querySelector(`option[value="${model.id}"]`)
      
      // Hover over the option
      fireEvent.mouseEnter(option)

      // Wait for tooltip and verify pricing is displayed
      await waitFor(() => {
        const inputPriceText = model.input_price.toFixed(2)
        const outputPriceText = model.output_price.toFixed(2)
        
        // Check for input price
        expect(screen.getByText(new RegExp(`\\$${inputPriceText}`))).toBeInTheDocument()
        // Check for output price
        expect(screen.getByText(new RegExp(`\\$${outputPriceText}`))).toBeInTheDocument()
      })

      unmount()
    }
  })

  it('should display description metadata on hover for any predefined model', async () => {
    // Property: For any predefined model with a description, hovering should display it
    
    for (const model of mockModels.filter(m => m.description)) {
      const { unmount } = render(
        <ModelSelector
          provider={model.provider}
          selectedModel={model.id}
          availableModels={[model]}
          onModelChange={vi.fn()}
          isCustom={false}
          onToggleCustom={vi.fn()}
        />
      )

      const select = screen.getByRole('combobox')
      const option = select.querySelector(`option[value="${model.id}"]`)
      
      // Hover over the option
      fireEvent.mouseEnter(option)

      // Wait for tooltip and verify description is displayed
      await waitFor(() => {
        expect(screen.getByText(new RegExp(model.description))).toBeInTheDocument()
      })

      unmount()
    }
  })

  it('should display all metadata fields together on hover', async () => {
    // Property: Tooltip should contain all three metadata fields simultaneously
    
    const model = mockModels[0]
    
    render(
      <ModelSelector
        provider={model.provider}
        selectedModel={model.id}
        availableModels={[model]}
        onModelChange={vi.fn()}
        isCustom={false}
        onToggleCustom={vi.fn()}
      />
    )

    const select = screen.getByRole('combobox')
    const option = select.querySelector(`option[value="${model.id}"]`)
    
    // Hover over the option
    fireEvent.mouseEnter(option)

    // Wait for tooltip and verify all metadata is present
    await waitFor(() => {
      // Context window
      expect(screen.getByText(new RegExp(model.context_window.toLocaleString()))).toBeInTheDocument()
      // Input price
      expect(screen.getByText(new RegExp(`\\$${model.input_price.toFixed(2)}`))).toBeInTheDocument()
      // Output price
      expect(screen.getByText(new RegExp(`\\$${model.output_price.toFixed(2)}`))).toBeInTheDocument()
      // Description
      expect(screen.getByText(new RegExp(model.description))).toBeInTheDocument()
    })
  })

  it('should NOT display tooltip when in custom mode', async () => {
    // Property: Tooltips should only appear for predefined models, not in custom mode
    
    const model = mockModels[0]
    
    render(
      <ModelSelector
        provider={model.provider}
        selectedModel="custom-model-123"
        availableModels={[model]}
        onModelChange={vi.fn()}
        isCustom={true}
        onToggleCustom={vi.fn()}
      />
    )

    // In custom mode, there's no dropdown, so no tooltip should appear
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    
    // Try to find any metadata text - should not be present
    expect(screen.queryByText(new RegExp(model.context_window.toLocaleString()))).not.toBeInTheDocument()
    expect(screen.queryByText(new RegExp(`\\$${model.input_price.toFixed(2)}`))).not.toBeInTheDocument()
  })

  it('should hide tooltip when mouse leaves the option', async () => {
    // Property: Tooltip should disappear when hover ends
    
    const model = mockModels[0]
    
    render(
      <ModelSelector
        provider={model.provider}
        selectedModel={model.id}
        availableModels={[model]}
        onModelChange={vi.fn()}
        isCustom={false}
        onToggleCustom={vi.fn()}
      />
    )

    const select = screen.getByRole('combobox')
    const option = select.querySelector(`option[value="${model.id}"]`)
    
    // Hover over the option
    fireEvent.mouseEnter(option)

    // Wait for tooltip to appear
    await waitFor(() => {
      expect(screen.getByText(new RegExp(model.description))).toBeInTheDocument()
    })

    // Mouse leave
    fireEvent.mouseLeave(option)

    // Wait for tooltip to disappear
    await waitFor(() => {
      expect(screen.queryByText(new RegExp(model.description))).not.toBeInTheDocument()
    })
  })

  it('should display tooltip for different models when hovering over each', async () => {
    // Property: Each model should display its own unique metadata
    
    const twoModels = [mockModels[0], mockModels[1]]
    
    render(
      <ModelSelector
        provider="openai"
        selectedModel={twoModels[0].id}
        availableModels={twoModels}
        onModelChange={vi.fn()}
        isCustom={false}
        onToggleCustom={vi.fn()}
      />
    )

    const select = screen.getByRole('combobox')
    
    // Hover over first model
    const option1 = select.querySelector(`option[value="${twoModels[0].id}"]`)
    fireEvent.mouseEnter(option1)
    
    await waitFor(() => {
      expect(screen.getByText(new RegExp(twoModels[0].description))).toBeInTheDocument()
    })
    
    fireEvent.mouseLeave(option1)
    
    // Wait for first tooltip to disappear
    await waitFor(() => {
      expect(screen.queryByText(new RegExp(twoModels[0].description))).not.toBeInTheDocument()
    })

    // Hover over second model
    const option2 = select.querySelector(`option[value="${twoModels[1].id}"]`)
    fireEvent.mouseEnter(option2)
    
    await waitFor(() => {
      expect(screen.getByText(new RegExp(twoModels[1].description))).toBeInTheDocument()
    })
  })

  it('should display tooltip with accessible role', async () => {
    // Property: Tooltip should be accessible with proper ARIA attributes
    
    const model = mockModels[0]
    
    const { container } = render(
      <ModelSelector
        provider={model.provider}
        selectedModel={model.id}
        availableModels={[model]}
        onModelChange={vi.fn()}
        isCustom={false}
        onToggleCustom={vi.fn()}
      />
    )

    const select = screen.getByRole('combobox')
    const option = select.querySelector(`option[value="${model.id}"]`)
    
    // Hover over the option
    fireEvent.mouseEnter(option)

    // Wait for tooltip and verify it has proper accessibility attributes
    await waitFor(() => {
      const tooltip = container.querySelector('[role="tooltip"]')
      expect(tooltip).toBeInTheDocument()
    })
  })

  it('should handle models with zero pricing correctly', async () => {
    // Property: Models with $0.00 pricing should still display the price
    
    const freeModel = {
      id: 'free-model',
      name: 'Free Model',
      provider: 'openai',
      context_window: 100000,
      input_price: 0.00,
      output_price: 0.00,
      description: 'Free preview model'
    }
    
    render(
      <ModelSelector
        provider="openai"
        selectedModel={freeModel.id}
        availableModels={[freeModel]}
        onModelChange={vi.fn()}
        isCustom={false}
        onToggleCustom={vi.fn()}
      />
    )

    const select = screen.getByRole('combobox')
    const option = select.querySelector(`option[value="${freeModel.id}"]`)
    
    // Hover over the option
    fireEvent.mouseEnter(option)

    // Wait for tooltip and verify $0.00 is displayed (both input and output)
    await waitFor(() => {
      const priceElements = screen.getAllByText(/\$0\.00/)
      expect(priceElements.length).toBeGreaterThanOrEqual(1)
      priceElements.forEach(el => expect(el).toBeInTheDocument())
    })
  })

  it('should handle models without description gracefully', async () => {
    // Property: Models without description should still show other metadata
    
    const modelWithoutDesc = {
      id: 'no-desc-model',
      name: 'No Description Model',
      provider: 'openai',
      context_window: 50000,
      input_price: 1.00,
      output_price: 2.00,
      description: undefined
    }
    
    render(
      <ModelSelector
        provider="openai"
        selectedModel={modelWithoutDesc.id}
        availableModels={[modelWithoutDesc]}
        onModelChange={vi.fn()}
        isCustom={false}
        onToggleCustom={vi.fn()}
      />
    )

    const select = screen.getByRole('combobox')
    const option = select.querySelector(`option[value="${modelWithoutDesc.id}"]`)
    
    // Hover over the option
    fireEvent.mouseEnter(option)

    // Wait for tooltip and verify context window and pricing are still displayed
    await waitFor(() => {
      expect(screen.getByText(new RegExp(modelWithoutDesc.context_window.toLocaleString()))).toBeInTheDocument()
      expect(screen.getByText(/\$1\.00/)).toBeInTheDocument()
      expect(screen.getByText(/\$2\.00/)).toBeInTheDocument()
    })
  })
})
