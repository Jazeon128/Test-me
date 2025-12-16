import { useState } from 'react'
import { BookOpen, Key, Upload, Zap, ArrowRight } from 'lucide-react'
import SettingsDialog from './SettingsDialog'

/**
 * WelcomeScreen Component
 * First-run experience that guides users through initial setup
 * Implements Requirements 4.4: Welcome screen with API key configuration prompt
 */
export default function WelcomeScreen({ onComplete }) {
  const [showSettings, setShowSettings] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)

  const steps = [
    {
      icon: BookOpen,
      title: 'Welcome to Test Me',
      description: 'Transform your study materials into interactive flashcards using AI.',
      content: (
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            Test Me helps you learn faster by automatically generating flashcards from your documents, 
            PDFs, and notes using advanced AI technology.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
              <Upload className="h-8 w-8 text-primary-600 dark:text-primary-400 mb-2" />
              <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Upload</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Upload PDFs, documents, or paste text
              </p>
            </div>
            <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
              <Zap className="h-8 w-8 text-primary-600 dark:text-primary-400 mb-2" />
              <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Generate</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                AI creates smart flashcards automatically
              </p>
            </div>
            <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
              <BookOpen className="h-8 w-8 text-primary-600 dark:text-primary-400 mb-2" />
              <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Study</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Practice with spaced repetition
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      icon: Key,
      title: 'Configure Your AI Provider',
      description: 'To generate flashcards, you\'ll need an API key from an AI provider.',
      content: (
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            Test Me supports multiple AI providers. Choose the one that works best for you:
          </p>
          <div className="space-y-3">
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">OpenAI</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                GPT-4 and GPT-3.5 models. Great for general-purpose flashcard generation.
              </p>
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
              >
                Get an OpenAI API key →
              </a>
            </div>
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Anthropic</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Claude models. Excellent for detailed explanations and complex topics.
              </p>
              <a
                href="https://console.anthropic.com/account/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
              >
                Get an Anthropic API key →
              </a>
            </div>
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Google</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Gemini models. Fast and cost-effective for large documents.
              </p>
              <a
                href="https://makersuite.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
              >
                Get a Google API key →
              </a>
            </div>
          </div>
          <div className="mt-6">
            <button
              onClick={() => setShowSettings(true)}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 shadow-lg shadow-primary-500/30 transition-all font-medium"
            >
              <Key size={20} />
              Configure API Key Now
            </button>
          </div>
        </div>
      ),
    },
  ]

  const currentStepData = steps[currentStep]
  const Icon = currentStepData.icon

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      // On the last step, complete the welcome flow
      handleComplete()
    }
  }

  const handleComplete = () => {
    // Mark welcome as completed in settings
    if (window.electronAPI) {
      window.electronAPI.setSetting('welcomeCompleted', true)
    }
    onComplete()
  }

  const handleSkip = () => {
    handleComplete()
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 animate-fade-in">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl mx-4 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary-600 to-primary-700 p-8 text-white">
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl">
                <Icon className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">{currentStepData.title}</h1>
                <p className="text-primary-100 mt-1">{currentStepData.description}</p>
              </div>
            </div>
            
            {/* Progress Indicator */}
            <div className="flex gap-2 mt-6">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={`h-1 flex-1 rounded-full transition-all ${
                    index <= currentStep
                      ? 'bg-white'
                      : 'bg-white/30'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="p-8">
            {currentStepData.content}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <button
              onClick={handleSkip}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Skip for now
            </button>
            
            <div className="flex items-center gap-3">
              {currentStep > 0 && (
                <button
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  Back
                </button>
              )}
              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-500/30 transition-all"
              >
                {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Dialog */}
      <SettingsDialog
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </>
  )
}
