import PropTypes from 'prop-types';

/**
 * ErrorDialog Component
 * Displays error messages with troubleshooting steps and retry functionality
 * Implements Requirements 6.1: Backend failure error dialogs
 */
const ErrorDialog = ({ 
  isOpen, 
  onClose, 
  title, 
  message, 
  troubleshootingSteps, 
  onRetry,
  showRetry = true 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
              <svg 
                className="w-6 h-6 text-red-500 mr-2" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                />
              </svg>
              {title}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {/* Error Message */}
          <div className="mb-4">
            <p className="text-gray-700 dark:text-gray-300">{message}</p>
          </div>

          {/* Troubleshooting Steps */}
          {troubleshootingSteps && troubleshootingSteps.length > 0 && (
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Troubleshooting steps:
              </h3>
              <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
                {troubleshootingSteps.map((step, index) => (
                  <li key={index} className="ml-2">
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Additional Help */}
          <div className="bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Need more help?</strong> Check the application logs for detailed error information.
              You can access logs from the Help menu.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            Close
          </button>
          {showRetry && onRetry && (
            <button
              onClick={onRetry}
              className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

ErrorDialog.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
  troubleshootingSteps: PropTypes.arrayOf(PropTypes.string),
  onRetry: PropTypes.func,
  showRetry: PropTypes.bool,
};

ErrorDialog.defaultProps = {
  troubleshootingSteps: [],
  onRetry: null,
  showRetry: true,
};

export default ErrorDialog;
