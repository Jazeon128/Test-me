import { ExternalLink, Info } from 'lucide-react'

/**
 * FormatExamples Component
 * Displays provider-specific model name format examples and documentation links
 * Implements Requirements 5.1, 5.2, 5.3, 5.4, 5.5: Format examples and documentation
 * 
 * @param {Object} props
 * @param {string} props.provider - Current AI provider ('anthropic', 'openai', 'gemini')
 */
export default function FormatExamples({ provider }) {
  const formatData = {
    anthropic: {
      examples: [
        'claude-sonnet-5',
        'claude-opus-5',
        'claude-haiku-4-5'
      ],
      documentationUrl: 'https://docs.anthropic.com/en/docs/about-claude/models'
    },
    openai: {
      examples: [
        'gpt-4o',
        'gpt-4-turbo',
        'gpt-4o-mini'
      ],
      documentationUrl: 'https://platform.openai.com/docs/models'
    },
    gemini: {
      examples: [
        'gemini-3.8-flash',
        'gemini-3.5-flash-lite',
        'gemini-3.1-pro-preview'
      ],
      documentationUrl: 'https://ai.google.dev/gemini-api/docs/models'
    }
  }

  const data = formatData[provider]

  if (!data) {
    return null
  }

  return (
    <div className="mt-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
      <div className="flex items-start gap-2">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
            Format Examples for {provider.charAt(0).toUpperCase() + provider.slice(1)}
          </p>
          <div className="space-y-1">
            {data.examples.map((example, index) => (
              <code 
                key={index}
                className="block text-sm text-blue-800 dark:text-blue-200 bg-blue-100 dark:bg-blue-900/40 px-2 py-1 rounded font-mono"
              >
                {example}
              </code>
            ))}
          </div>
          <a
            href={data.documentationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline transition-colors"
          >
            View {provider.charAt(0).toUpperCase() + provider.slice(1)} model documentation
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </div>
  )
}
