import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { decksAPI, questionsAPI, tagsAPI } from '../services/api'
import { ArrowLeft, Plus, Play, Trash2, Save, X, Filter, Network } from 'lucide-react'
import TagManager, { TagBadge } from '../components/TagManager'

export default function DeckDetails() {
    const { deckId } = useParams()
    const navigate = useNavigate()
    const [deck, setDeck] = useState(null)
    const [loading, setLoading] = useState(true)
    const [showAddModal, setShowAddModal] = useState(false)

    // Tag filtering
    const [filterTags, setFilterTags] = useState([])
    const [showFilters, setShowFilters] = useState(false)

    // New Question State
    const [newQuestion, setNewQuestion] = useState({
        question_text: '',
        options: [
            { text: '', is_correct: true },
            { text: '', is_correct: false },
            { text: '', is_correct: false },
            { text: '', is_correct: false }
        ],
        explanation: '',
        difficulty: 'medium',
        tags: []
    })

    useEffect(() => {
        loadDeck()
    }, [deckId])

    const loadDeck = async () => {
        try {
            const response = await decksAPI.get(deckId)
            setDeck(response.data)
        } catch (error) {
            console.error('Failed to load deck:', error)
            alert('Failed to load deck details')
            navigate('/decks')
        } finally {
            setLoading(false)
        }
    }

    const handleAddQuestion = async () => {
        // Validate
        if (!newQuestion.question_text.trim()) {
            alert('Question text is required')
            return
        }
        if (newQuestion.options.some(opt => !opt.text.trim())) {
            alert('All options must have text')
            return
        }

        try {
            const response = await questionsAPI.create({
                ...newQuestion,
                deck_id: parseInt(deckId)
            })

            // Add tags to the newly created question
            const questionId = response.data.id
            for (const tag of newQuestion.tags) {
                try {
                    await tagsAPI.addToQuestion(questionId, tag.id)
                } catch (err) {
                    console.error('Failed to add tag:', err)
                }
            }

            setShowAddModal(false)
            setNewQuestion({
                question_text: '',
                options: [
                    { text: '', is_correct: true },
                    { text: '', is_correct: false },
                    { text: '', is_correct: false },
                    { text: '', is_correct: false }
                ],
                explanation: '',
                difficulty: 'medium',
                tags: []
            })
            loadDeck()
        } catch (error) {
            console.error('Failed to create question:', error)
            alert('Failed to create question')
        }
    }

    const handleDeleteQuestion = async (questionId) => {
        if (!confirm('Are you sure you want to delete this question?')) return

        try {
            await questionsAPI.delete(questionId)
            loadDeck()
        } catch (error) {
            console.error('Failed to delete question:', error)
            alert('Failed to delete question')
        }
    }

    const updateOption = (index, field, value) => {
        const newOptions = [...newQuestion.options]
        newOptions[index] = { ...newOptions[index], [field]: value }

        // Ensure only one correct answer if setting to true
        if (field === 'is_correct' && value === true) {
            newOptions.forEach((opt, i) => {
                if (i !== index) opt.is_correct = false
            })
        }

        setNewQuestion({ ...newQuestion, options: newOptions })
    }

    // Filter questions by selected tags
    const getFilteredQuestions = () => {
        if (!deck || !deck.questions) return []
        if (filterTags.length === 0) return deck.questions

        return deck.questions.filter(q => {
            if (!q.tags || q.tags.length === 0) return false
            // Question must have at least one of the selected filter tags
            return filterTags.some(filterTag =>
                q.tags.some(qTag => qTag.id === filterTag.id)
            )
        })
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        )
    }

    if (!deck) return null

    return (
        <div className="max-w-4xl mx-auto px-4">
            {/* Header */}
            <div className="mb-8">
                <button
                    onClick={() => navigate('/decks')}
                    className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
                >
                    <ArrowLeft size={20} className="mr-2" />
                    Back to Decks
                </button>

                <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{deck.name}</h1>
                        <p className="mt-2 text-gray-600">{deck.description}</p>
                        <p className="mt-1 text-sm text-gray-500">{deck.num_questions} questions</p>
                    </div>
                    <div className="flex gap-3 w-full md:w-auto">
                        <button
                            onClick={() => navigate(`/decks/${deckId}/practice`)}
                            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition flex items-center gap-2"
                        >
                            <Play size={20} />
                            Practice Now
                        </button>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-900 transition flex items-center gap-2"
                        >
                            <Plus size={20} />
                            Add Card
                        </button>
                    </div>
                </div>

                {deck.documents?.length > 0 && (
                    <div className="mt-6 border-t border-gray-200 pt-4 dark:border-gray-700">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Explain a source on a canvas
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {deck.documents.map((document) => (
                                <button
                                    key={document.id}
                                    onClick={() => navigate(`/canvas?document=${document.id}`)}
                                    className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 transition hover:border-primary-500 hover:text-primary-700 dark:border-gray-600 dark:text-gray-300"
                                >
                                    <Network size={16} />
                                    {document.title || document.filename}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Questions List */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                    <div className="flex justify-between items-center">
                        <h2 className="font-semibold text-gray-700">Cards / Questions</h2>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition ${filterTags.length > 0 || showFilters
                                ? 'bg-primary-100 text-primary-700 hover:bg-primary-200'
                                : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            <Filter size={16} />
                            Filter by Tags
                            {filterTags.length > 0 && (
                                <span className="bg-primary-600 text-white px-2 py-0.5 rounded-full text-xs font-bold">
                                    {filterTags.length}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Tag Filter Panel */}
                    {showFilters && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <TagManager
                                selectedTags={filterTags}
                                onTagsChange={setFilterTags}
                                mode="select"
                            />
                        </div>
                    )}
                </div>

                {getFilteredQuestions().length > 0 ? (
                    <div className="divide-y divide-gray-200">
                        {getFilteredQuestions().map((question, index) => (
                            <div key={question.id} className="p-6 hover:bg-gray-50 transition group">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full font-medium">
                                                #{index + 1}
                                            </span>
                                            <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${question.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                                                question.difficulty === 'hard' ? 'bg-red-100 text-red-700' :
                                                    'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                {question.difficulty}
                                            </span>
                                        </div>
                                        <p className="text-gray-900 font-medium mb-2">{question.question_text}</p>

                                        {/* Tag Badges */}
                                        {question.tags && question.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {question.tags.map(tag => (
                                                    <TagBadge
                                                        key={tag.id}
                                                        tag={tag}
                                                        size="sm"
                                                        onClick={() => {
                                                            // Toggle tag filter when clicked
                                                            const isFiltered = filterTags.some(t => t.id === tag.id)
                                                            if (isFiltered) {
                                                                setFilterTags(filterTags.filter(t => t.id !== tag.id))
                                                            } else {
                                                                setFilterTags([...filterTags, tag])
                                                            }
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleDeleteQuestion(question.id)}
                                        className="text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition p-2"
                                        title="Delete Question"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-12 text-center text-gray-500">
                        No questions in this deck yet. Add one manually or upload a document!
                    </div>
                )}
            </div>

            {/* Add Question Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-900">Add New Card</h2>
                            <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Question Text */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Question</label>
                                <textarea
                                    value={newQuestion.question_text}
                                    onChange={(e) => setNewQuestion({ ...newQuestion, question_text: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                    rows="3"
                                    placeholder="Enter your question here..."
                                />
                            </div>

                            {/* Options */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Options (Select correct answer)</label>
                                <div className="space-y-3">
                                    {newQuestion.options.map((option, idx) => (
                                        <div key={idx} className="flex items-center gap-3">
                                            <input
                                                type="radio"
                                                name="correct_option"
                                                checked={option.is_correct}
                                                onChange={() => updateOption(idx, 'is_correct', true)}
                                                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                                            />
                                            <span className="font-mono text-gray-500 w-6">{String.fromCharCode(65 + idx)}.</span>
                                            <input
                                                type="text"
                                                value={option.text}
                                                onChange={(e) => updateOption(idx, 'text', e.target.value)}
                                                className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 ${option.is_correct ? 'border-green-300 bg-green-50' : 'border-gray-300'
                                                    }`}
                                                placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Explanation */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Explanation</label>
                                <textarea
                                    value={newQuestion.explanation}
                                    onChange={(e) => setNewQuestion({ ...newQuestion, explanation: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                    rows="2"
                                    placeholder="Why is the answer correct?"
                                />
                            </div>

                            {/* Difficulty */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty</label>
                                <select
                                    value={newQuestion.difficulty}
                                    onChange={(e) => setNewQuestion({ ...newQuestion, difficulty: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                >
                                    <option value="easy">Easy</option>
                                    <option value="medium">Medium</option>
                                    <option value="hard">Hard</option>
                                </select>
                            </div>

                            {/* Tags */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
                                <TagManager
                                    selectedTags={newQuestion.tags}
                                    onTagsChange={(tags) => setNewQuestion({ ...newQuestion, tags })}
                                    mode="select"
                                />
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddQuestion}
                                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition flex items-center gap-2"
                            >
                                <Save size={18} />
                                Save Card
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
