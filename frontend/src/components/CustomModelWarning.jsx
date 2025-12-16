import { AlertTriangle } from 'lucide-react'

/**
 * CustomModelWarning Component
 * Displays a subtle warning message for custom models
 * Implements Requirement 3.3: Warning that custom models are not validated
 * 
 * @param {Object} props
 * @param {string} props.provider - Current AI provider name for display
 */
export default function CustomModelWarning({ provider }) {
  return (
    <div 
      className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg"
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
            Custom Model Notice
          </p>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
            This custom model name will be sent directly to {provider.charAt(0).toUpperCase() + provider.slice(1)} without validation. 
            Please ensure the model name is correct and available in your account.
          </p>
        </div>
      </div>
    </div>
  )
}
