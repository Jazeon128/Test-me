/**
 * Property-Based Tests for Custom Model Input Validation
 * Feature: custom-model-input, Property 2: Non-empty strings accepted as model names
 * Validates: Requirements 1.3, 4.1
 * 
 * Property 2: Non-empty strings accepted as model names
 * For any non-empty string, when submitted as a custom model name, the system
 * should accept it without validation errors.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import fc from 'fast-check'
import ModelSelector from '../ModelSelector'

describe('Property 2: Non-empty strings accepted as model names', () => {
  const mockModels = [
    {
      id: 'model-1',
      name: 'Model 1',
      provider: 'openai',
      context_window: 128000,
      input_price: 2.50,
      output_price: 10.00
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should accept any non-empty string as a valid custom model name', () => {
    // Property: For any non-empty string, the system should accept it without validation errors
    
    fc.assert(
      fc.property(
        // Generate non-empty strings (at least 1 non-whitespace character)
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        (modelName) => {
          const onModelChange = vi.fn()
          const onValidationChange = vi.fn()
          
          const { unmount } = render(
            <ModelSelector
              provider="openai"
              selectedModel=""
              availableModels={mockModels}
              onModelChange={onModelChange}
              isCustom={true}
              onToggleCustom={vi.fn()}
              onValidationChange={onValidationChange}
            />
          )

          const input = screen.getByPlaceholderText(/Enter custom .* model name/)
          
          // Enter the generated model name
          fireEvent.change(input, { target: { value: modelName } })
          
          // Trigger blur to validate
          fireEvent.blur(input)
          
          // Verify no error message is displayed
          const errorMessage = screen.queryByRole('alert')
          expect(errorMessage).toBeNull()
          
          // Verify input does not have error styling
          expect(input).not.toHaveAttribute('aria-invalid', 'true')
          
          // Verify onModelChange was called with the model name
          expect(onModelChange).toHaveBeenCalledWith(modelName)
          
          // Verify validation callback indicates valid state
          // It should be called at least once with true after blur
          const validationCalls = onValidationChange.mock.calls
          const hasValidCall = validationCalls.some(call => call[0] === true)
          expect(hasValidCall).toBe(true)
          
          unmount()
        }
      ),
      { numRuns: 100 } // Run 100 iterations as specified in design
    )
  })

  it('should accept strings with special characters as valid model names', () => {
    // Property: Non-empty strings with special characters should be accepted
    
    fc.assert(
      fc.property(
        // Generate strings with various special characters commonly used in model names
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        (modelName) => {
          const onModelChange = vi.fn()
          const onValidationChange = vi.fn()
          
          const { unmount } = render(
            <ModelSelector
              provider="anthropic"
              selectedModel=""
              availableModels={mockModels}
              onModelChange={onModelChange}
              isCustom={true}
              onToggleCustom={vi.fn()}
              onValidationChange={onValidationChange}
            />
          )

          const input = screen.getByPlaceholderText(/Enter custom .* model name/)
          
          fireEvent.change(input, { target: { value: modelName } })
          fireEvent.blur(input)
          
          // Should not show error
          expect(screen.queryByRole('alert')).toBeNull()
          expect(input).not.toHaveAttribute('aria-invalid', 'true')
          
          unmount()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should accept strings with numbers and letters as valid model names', () => {
    // Property: Alphanumeric strings should be accepted
    
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        (modelName) => {
          const onModelChange = vi.fn()
          const onValidationChange = vi.fn()
          
          const { unmount } = render(
            <ModelSelector
              provider="gemini"
              selectedModel=""
              availableModels={mockModels}
              onModelChange={onModelChange}
              isCustom={true}
              onToggleCustom={vi.fn()}
              onValidationChange={onValidationChange}
            />
          )

          const input = screen.getByPlaceholderText(/Enter custom .* model name/)
          
          fireEvent.change(input, { target: { value: modelName } })
          fireEvent.blur(input)
          
          // Should not show error
          expect(screen.queryByRole('alert')).toBeNull()
          
          unmount()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should reject empty strings and show validation error', () => {
    // Negative test: Empty strings should be rejected
    
    const onModelChange = vi.fn()
    const onValidationChange = vi.fn()
    
    render(
      <ModelSelector
        provider="openai"
        selectedModel=""
        availableModels={mockModels}
        onModelChange={onModelChange}
        isCustom={true}
        onToggleCustom={vi.fn()}
        onValidationChange={onValidationChange}
      />
    )

    const input = screen.getByPlaceholderText(/Enter custom .* model name/)
    
    // Enter empty string
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.blur(input)
    
    // Should show error message
    const errorMessage = screen.getByRole('alert')
    expect(errorMessage).toBeInTheDocument()
    expect(errorMessage).toHaveTextContent(/Model name cannot be empty/i)
    
    // Input should have error styling
    expect(input).toHaveAttribute('aria-invalid', 'true')
    
    // Validation callback should indicate invalid state
    const validationCalls = onValidationChange.mock.calls
    const lastCall = validationCalls[validationCalls.length - 1]
    expect(lastCall[0]).toBe(false)
  })

  it('should reject whitespace-only strings and show validation error', () => {
    // Property: Strings with only whitespace should be rejected
    
    fc.assert(
      fc.property(
        // Generate strings with only whitespace characters
        fc.array(fc.constantFrom(' ', '\t', '\n'), { minLength: 1, maxLength: 20 }).map(chars => chars.join('')),
        (whitespaceString) => {
          const onModelChange = vi.fn()
          const onValidationChange = vi.fn()
          
          const { unmount } = render(
            <ModelSelector
              provider="openai"
              selectedModel=""
              availableModels={mockModels}
              onModelChange={onModelChange}
              isCustom={true}
              onToggleCustom={vi.fn()}
              onValidationChange={onValidationChange}
            />
          )

          const input = screen.getByPlaceholderText(/Enter custom .* model name/)
          
          fireEvent.change(input, { target: { value: whitespaceString } })
          fireEvent.blur(input)
          
          // Should show error message
          const errorMessage = screen.queryByRole('alert')
          expect(errorMessage).toBeInTheDocument()
          expect(errorMessage).toHaveTextContent(/Model name cannot be empty/i)
          
          // Input should have error styling
          expect(input).toHaveAttribute('aria-invalid', 'true')
          
          unmount()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should accept strings with leading/trailing whitespace after trimming', () => {
    // Property: Strings with leading/trailing whitespace but non-empty content should be accepted
    
    fc.assert(
      fc.property(
        fc.tuple(
          fc.array(fc.constantFrom(' ', '\t'), { maxLength: 5 }).map(chars => chars.join('')), // leading whitespace
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), // content
          fc.array(fc.constantFrom(' ', '\t'), { maxLength: 5 }).map(chars => chars.join('')) // trailing whitespace
        ),
        ([leading, content, trailing]) => {
          const modelName = leading + content + trailing
          const onModelChange = vi.fn()
          const onValidationChange = vi.fn()
          
          const { unmount } = render(
            <ModelSelector
              provider="openai"
              selectedModel=""
              availableModels={mockModels}
              onModelChange={onModelChange}
              isCustom={true}
              onToggleCustom={vi.fn()}
              onValidationChange={onValidationChange}
            />
          )

          const input = screen.getByPlaceholderText(/Enter custom .* model name/)
          
          fireEvent.change(input, { target: { value: modelName } })
          fireEvent.blur(input)
          
          // Should not show error (content is non-empty after trim)
          expect(screen.queryByRole('alert')).toBeNull()
          expect(input).not.toHaveAttribute('aria-invalid', 'true')
          
          unmount()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should validate on blur, not on every keystroke', () => {
    // Property: Validation should only trigger after blur, not during typing
    
    const onValidationChange = vi.fn()
    
    render(
      <ModelSelector
        provider="openai"
        selectedModel=""
        availableModels={mockModels}
        onModelChange={vi.fn()}
        isCustom={true}
        onToggleCustom={vi.fn()}
        onValidationChange={onValidationChange}
      />
    )

    const input = screen.getByPlaceholderText(/Enter custom .* model name/)
    
    // Type empty string - should not show error yet
    fireEvent.change(input, { target: { value: '' } })
    expect(screen.queryByRole('alert')).toBeNull()
    
    // Blur - now error should appear
    fireEvent.blur(input)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    
    // Type valid string - error should disappear immediately (field is now touched)
    fireEvent.change(input, { target: { value: 'valid-model' } })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('should call onValidationChange callback with correct validation state', () => {
    // Property: Validation callback should be called with true for valid input, false for invalid
    
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), // valid
          fc.array(fc.constantFrom(' ', '\t'), { minLength: 1, maxLength: 10 }).map(chars => chars.join('')) // invalid (whitespace only)
        ),
        (modelName) => {
          const onValidationChange = vi.fn()
          const isValid = modelName.trim().length > 0
          
          const { unmount } = render(
            <ModelSelector
              provider="openai"
              selectedModel=""
              availableModels={mockModels}
              onModelChange={vi.fn()}
              isCustom={true}
              onToggleCustom={vi.fn()}
              onValidationChange={onValidationChange}
            />
          )

          const input = screen.getByPlaceholderText(/Enter custom .* model name/)
          
          fireEvent.change(input, { target: { value: modelName } })
          fireEvent.blur(input)
          
          // Check that validation callback was called with correct state
          const validationCalls = onValidationChange.mock.calls
          const lastCall = validationCalls[validationCalls.length - 1]
          expect(lastCall[0]).toBe(isValid)
          
          unmount()
        }
      ),
      { numRuns: 100 }
    )
  })
})
