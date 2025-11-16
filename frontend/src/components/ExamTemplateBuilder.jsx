import { useState, useEffect } from 'react'
import { examTemplatesAPI } from '../services/api'
import { Info, ChevronDown, ChevronUp } from 'lucide-react'

export default function ExamTemplateBuilder({ onConfigChange, disabled = false }) {
  const [certTypes, setCertTypes] = useState([])
  const [selectedCertType, setSelectedCertType] = useState('gcp_ace')
  const [archetypes, setArchetypes] = useState({})
  const [selectedArchetype, setSelectedArchetype] = useState('')
  const [topics, setTopics] = useState([])
  const [topicInput, setTopicInput] = useState('')
  const [constraints, setConstraints] = useState('')
  const [distractorStrategy, setDistractorStrategy] = useState('mixed')
  const [strategies, setStrategies] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedArchetype, setExpandedArchetype] = useState(null)

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    loadArchetypes(selectedCertType)
  }, [selectedCertType])

  useEffect(() => {
    // Always send config (archetype can be empty for auto-detect)
    onConfigChange({
      cert_type: selectedCertType,
      archetype: selectedArchetype || null,
      topics: topics.length > 0 ? topics : null,
      constraints: constraints.trim() || null,
      distractor_strategy: distractorStrategy
    })
  }, [selectedCertType, selectedArchetype, topics, constraints, distractorStrategy])

  const loadInitialData = async () => {
    try {
      const [certTypesRes, strategiesRes] = await Promise.all([
        examTemplatesAPI.getCertTypes(),
        examTemplatesAPI.getDistractorStrategies()
      ])

      setCertTypes(certTypesRes.data.cert_types)
      setStrategies(strategiesRes.data.strategies)
    } catch (error) {
      console.error('Failed to load initial data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadArchetypes = async (certType) => {
    try {
      const response = await examTemplatesAPI.getArchetypes(certType)
      setArchetypes(response.data.archetypes)

      // Default to auto-detect (empty archetype) - don't auto-select
      if (selectedArchetype && !response.data.archetypes[selectedArchetype]) {
        setSelectedArchetype('')
      }
    } catch (error) {
      console.error('Failed to load archetypes:', error)
    }
  }

  const handleAddTopic = () => {
    if (topicInput.trim() && !topics.includes(topicInput.trim())) {
      setTopics([...topics, topicInput.trim()])
      setTopicInput('')
    }
  }

  const handleRemoveTopic = (topic) => {
    setTopics(topics.filter(t => t !== topic))
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTopic()
    }
  }

  const handleArchetypeSelect = (archetypeKey) => {
    setSelectedArchetype(archetypeKey)
    // Don't pre-populate - let user decide or leave empty
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-blue-900">Professional Certification Exam Questions</h3>
          <p className="text-sm text-blue-800 mt-1">
            Generate questions in the style of professional certification exams (GCP ACE, AWS SAA).
            Select an archetype and customize to match your study materials.
          </p>
        </div>
      </div>

      {/* Certification Type Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Certification Type
        </label>
        <select
          value={selectedCertType}
          onChange={(e) => setSelectedCertType(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          disabled={disabled}
        >
          {certTypes.map((cert) => (
            <option key={cert.id} value={cert.id}>
              {cert.name} - {cert.full_name}
            </option>
          ))}
        </select>
      </div>

      {/* Archetype Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Question Archetype (Optional)
        </label>
        <p className="text-xs text-gray-500 mb-3">
          Select a specific question type, or leave unselected to let AI analyze the document and choose the best style
        </p>

        {/* Auto-detect option */}
        <div className="border border-gray-200 rounded-lg overflow-hidden mb-2">
          <button
            type="button"
            onClick={() => {
              setSelectedArchetype('')
              setExpandedArchetype(null)
            }}
            className={`w-full px-4 py-3 text-left flex items-center justify-between transition ${
              selectedArchetype === ''
                ? 'bg-primary-50 border-l-4 border-primary-600'
                : 'bg-white hover:bg-gray-50'
            }`}
            disabled={disabled}
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={selectedArchetype === ''}
                  onChange={() => setSelectedArchetype('')}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                  disabled={disabled}
                />
                <span className="font-medium text-gray-900">🤖 Auto-Detect (Recommended)</span>
              </div>
              <p className="text-sm text-gray-600 mt-1 ml-6">
                Let the AI analyze your document and automatically choose the best question style
              </p>
            </div>
          </button>
        </div>

        <div className="space-y-2">
          {Object.entries(archetypes).map(([key, archetype]) => (
            <div key={key} className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  if (selectedArchetype === key) {
                    setExpandedArchetype(expandedArchetype === key ? null : key)
                  } else {
                    handleArchetypeSelect(key)
                    setExpandedArchetype(key)
                  }
                }}
                className={`w-full px-4 py-3 text-left flex items-center justify-between transition ${
                  selectedArchetype === key
                    ? 'bg-primary-50 border-l-4 border-primary-600'
                    : 'bg-white hover:bg-gray-50'
                }`}
                disabled={disabled}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={selectedArchetype === key}
                      onChange={() => handleArchetypeSelect(key)}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                      disabled={disabled}
                    />
                    <span className="font-medium text-gray-900">{archetype.name}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1 ml-6">{archetype.description}</p>
                </div>
                {selectedArchetype === key && (
                  expandedArchetype === key ? <ChevronUp size={20} /> : <ChevronDown size={20} />
                )}
              </button>

              {selectedArchetype === key && expandedArchetype === key && (
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm">
                  <div className="space-y-2">
                    <div>
                      <span className="font-medium text-gray-700">Structure:</span>
                      <ul className="mt-1 ml-4 list-disc text-gray-600 space-y-1">
                        {archetype.structure?.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    {archetype.example_constraints?.length > 0 && (
                      <div>
                        <span className="font-medium text-gray-700">Example Constraints:</span>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {archetype.example_constraints.slice(0, 3).map((constraint, idx) => (
                            <span key={idx} className="px-2 py-1 bg-white border border-gray-300 rounded text-xs">
                              "{constraint}"
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Topics/Services */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Topics / Services to Focus On
        </label>
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter a service or topic (e.g., Cloud Storage, VPC, IAM)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              disabled={disabled}
            />
            <button
              type="button"
              onClick={handleAddTopic}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
              disabled={disabled || !topicInput.trim()}
            >
              Add
            </button>
          </div>

          {topics.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {topics.map((topic, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-2 px-3 py-1 bg-primary-100 text-primary-800 rounded-full text-sm"
                >
                  {topic}
                  <button
                    type="button"
                    onClick={() => handleRemoveTopic(topic)}
                    className="hover:text-primary-900"
                    disabled={disabled}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {selectedArchetype && archetypes[selectedArchetype]?.common_services && (
            <div className="text-xs text-gray-500">
              <span className="font-medium">Suggested for this archetype:</span>{' '}
              {archetypes[selectedArchetype].common_services.slice(0, 5).join(', ')}
            </div>
          )}
        </div>
      </div>

      {/* Constraints */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Scenario Constraints
        </label>
        <input
          type="text"
          value={constraints}
          onChange={(e) => setConstraints(e.target.value)}
          placeholder='e.g., "most cost-effective", "least privilege", "without managing infrastructure"'
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          disabled={disabled}
        />
        <p className="text-xs text-gray-500 mt-1">
          The "twist" that narrows down the correct answer (e.g., cost, security, performance requirements)
        </p>
      </div>

      {/* Distractor Strategy */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Wrong Answer Strategy
        </label>
        <select
          value={distractorStrategy}
          onChange={(e) => setDistractorStrategy(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          disabled={disabled}
        >
          {strategies.map((strategy) => (
            <option key={strategy.id} value={strategy.id}>
              {strategy.name}
            </option>
          ))}
        </select>
        {strategies.find(s => s.id === distractorStrategy) && (
          <p className="text-xs text-gray-500 mt-1">
            {strategies.find(s => s.id === distractorStrategy).description}
          </p>
        )}
      </div>

      {/* Summary */}
      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
        <h4 className="font-semibold text-green-900 mb-2">✓ Configuration Ready</h4>
        <div className="text-sm text-green-800 space-y-1">
          <p><strong>Type:</strong> {certTypes.find(c => c.id === selectedCertType)?.name}</p>
          <p><strong>Archetype:</strong> {selectedArchetype ? archetypes[selectedArchetype]?.name : '🤖 Auto-Detect (AI will analyze document)'}</p>
          {topics.length > 0 && <p><strong>Topics:</strong> {topics.join(', ')}</p>}
          {constraints && <p><strong>Constraint:</strong> "{constraints}"</p>}
          <p><strong>Distractor Strategy:</strong> {strategies.find(s => s.id === distractorStrategy)?.name}</p>
        </div>
      </div>
    </div>
  )
}
