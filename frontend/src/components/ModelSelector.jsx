import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Edit3, AlertCircle } from 'lucide-react'
import FormatExamples from './FormatExamples'
import CustomModelWarning from './CustomModelWarning'

/**
 * ModelSelector Component
 * Provides UI for selecting AI models from predefined list or entering custom model names
 * Implements Requirements 1.1, 1.2, 1.3: Model selection with custom input option and validation
 * 
 * @param {Object} props
 * @param {string} props.provider - Current AI provider ('anthropic', 'openai', 'gemini')
 * @param {string} props.selectedModel - Currently selected/entered model ID
 * @param {Array} props.availableModels - Array of predefined AIModel objects for the provider
 * @param {Function} props.onModelChange - Callback when model selection changes (model: string) => void
 * @param {boolean} props.isCustom - Whether custom input mode is active
 * @param {Function} props.onToggleCustom - Callback to toggle between dropdown and custom input
 * @param {Function} props.onValidationChange - Callback when validation state changes (isValid: boolean) => void
 */
export default function ModelSelector({
  provider,
  selectedModel,
  availableModels,
  onModelChange,
  isCustom,
  onToggleCustom,
  onValidationChange
}) {
  const [customModelValue, setCustomModelValue] = useState(selectedModel || '')
  const [validationError, setValidationError] = useState('')
  const [touched, setTouched] = useState(false)
  const [hoveredModel, setHoveredModel] = useState(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const selectRef = useRef(null)

  // Validate custom model input
  const validateCustomInput = (value) => {
    const trimmedValue = value.trim()
    if (trimmedValue === '') {
      setValidationError('Model name cannot be empty')
      if (onValidationChange) {
        onValidationChange(false)
      }
      return false
    }
    setValidationError('')
    if (onValidationChange) {
      onValidationChange(true)
    }
    return true
  }

  // Handle custom input change
  const handleCustomInputChange = (e) => {
    const value = e.target.value
    setCustomModelValue(value)
    onModelChange(value)
    
    // Validate if field has been touched
    if (touched) {
      validateCustomInput(value)
    }
  }

  // Handle blur event to mark field as touched and validate
  const handleCustomInputBlur = () => {
    setTouched(true)
    validateCustomInput(customModelValue)
  }

  // Handle predefined model selection
  const handlePredefinedChange = (e) => {
    const value = e.target.value
    onModelChange(value)
  }

  // Handle toggle to custom mode
  const handleToggleToCustom = () => {
    setCustomModelValue(selectedModel || '')
    setValidationError('')
    setTouched(false)
    onToggleCustom()
    // Validate initial value if not empty
    if (selectedModel && selectedModel.trim() !== '') {
      if (onValidationChange) {
        onValidationChange(true)
      }
    } else {
      if (onValidationChange) {
        onValidationChange(false)
      }
    }
  }

  // Handle toggle to predefined mode
  const handleToggleToPredefined = () => {
    setValidationError('')
    setTouched(false)
    onToggleCustom()
    // Reset to first available model if current selection is not in list
    if (availableModels.length > 0 && !availableModels.find(m => m.id === selectedModel)) {
      onModelChange(availableModels[0].id)
    }
    // Predefined models are always valid
    if (onValidationChange) {
      onValidationChange(true)
    }
  }

  // Handle mouse enter on option elements
  const handleOptionMouseEnter = (e, modelId) => {
    const model = availableModels.find(m => m.id === modelId)
    if (model && selectRef.current) {
      setHoveredModel(model)
      // Position tooltip near the select element
      const rect = selectRef.current.getBoundingClientRect()
      setTooltipPosition({
        x: rect.left,
        y: rect.bottom + 8
      })
    }
  }

  // Handle mouse leave from option elements
  const handleOptionMouseLeave = () => {
    setHoveredModel(null)
  }

  // Add event listeners to option elements
  useEffect(() => {
    if (!isCustom && selectRef.current) {
      const options = selectRef.current.querySelectorAll('option')
      options.forEach(option => {
        option.addEventListener('mouseenter', (e) => handleOptionMouseEnter(e, option.value))
        option.addEventListener('mouseleave', handleOptionMouseLeave)
      })

      return () => {
        options.forEach(option => {
          option.removeEventListener('mouseenter', (e) => handleOptionMouseEnter(e, option.value))
          option.removeEventListener('mouseleave', handleOptionMouseLeave)
        })
      }
    }
  }, [isCustom, availableModels])

  return (
    <div className="space-y-3">
      {/* Mode Toggle */}
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          AI Model
        </label>
        <button
          type="button"
          onClick={isCustom ? handleToggleToPredefined : handleToggleToCustom}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
        >
          <Edit3 size={14} />
          {isCustom ? 'Use Predefined' : 'Use Custom'}
        </button>
      </div>

      {/* Predefined Dropdown */}
      {!isCustom && (
        <div className="relative">
          <select
            ref={selectRef}
            id="model-select"
            aria-label="AI Model"
            value={selectedModel}
            onChange={handlePredefinedChange}
            className="w-full px-4 py-3 pr-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white appearance-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all cursor-pointer"
          >
            {availableModels.length === 0 && (
              <option value="">No models available</option>
            )}
            {availableModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
          <ChevronDown 
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" 
            size={20} 
          />
        </div>
      )}

      {/* Custom Input */}
      {isCustom && (
        <div>
          <div className="relative">
            <input
              type="text"
              value={customModelValue}
              onChange={handleCustomInputChange}
              onBlur={handleCustomInputBlur}
              placeholder={`Enter custom ${provider} model name`}
              className={`w-full px-4 py-3 rounded-lg border ${
                validationError && touched
                  ? 'border-red-500 dark:border-red-500 focus:ring-red-500'
                  : 'border-gray-300 dark:border-gray-600 focus:ring-primary-500'
              } bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:border-transparent transition-all`}
              aria-invalid={validationError && touched ? 'true' : 'false'}
              aria-describedby={validationError && touched ? 'custom-model-error' : undefined}
            />
            {validationError && touched && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <AlertCircle className="h-5 w-5 text-red-500" />
              </div>
            )}
          </div>
          {validationError && touched && (
            <p 
              id="custom-model-error" 
              className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1.5"
              role="alert"
            >
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {validationError}
            </p>
          )}
          
          {/* Format Examples - Requirements 5.1, 5.2, 5.3, 5.4, 5.5 */}
          <FormatExamples provider={provider} />
          
          {/* Custom Model Warning - Requirement 3.3 */}
          <CustomModelWarning provider={provider} />
        </div>
      )}

      {/* Model Metadata Tooltip - Requirement 3.2 */}
      {!isCustom && hoveredModel && (
        <div
          role="tooltip"
          className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 max-w-md"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
          }}
        >
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
                  {hoveredModel.name}
                </h4>
                {hoveredModel.description && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {hoveredModel.description}
                  </p>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Context Window</p>
                <p className="text-sm text-gray-900 dark:text-white font-semibold">
                  {hoveredModel.context_window.toLocaleString()} tokens
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Input Price</p>
                <p className="text-sm text-gray-900 dark:text-white font-semibold">
                  ${hoveredModel.input_price.toFixed(2)} / 1M tokens
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Output Price</p>
                <p className="text-sm text-gray-900 dark:text-white font-semibold">
                  ${hoveredModel.output_price.toFixed(2)} / 1M tokens
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
