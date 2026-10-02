import { serverMessage } from '../utils/serverMessage'
import Spinner from './Spinner'
import { useState, useEffect, useCallback } from 'react'
import { decksAPI, questionsAPI, tagsAPI } from '../services/api'
import { ArrowLeft, Plus, Play, Trash2, X, Filter, Network, Tag, Pencil } from 'lucide-react'
import TagManager, { TagBadge } from './TagManager'
import QuestionTagEditor from './QuestionTagEditor'
import HeldBackQuestions from './HeldBackQuestions'
import DeckItemForm from './DeckItemForm'

function isFlashcard(item) {
    return item.card_type === 'flashcard' || (item.options?.length === 1 &&
        item.options[0].text === 'Flip to see answer')
}

export default function DeckEditor({ deckId, onPractice, onDeleted: _onDeleted, onOpenCanvas, onBack, embedded = false }) {
    const [deck, setDeck] = useState(null)
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState('')
    const [showAddModal, setShowAddModal] = useState(false)

    // Tag filtering
    const [filterTags, setFilterTags] = useState([])
    const [showFilters, setShowFilters] = useState(false)

    // Per-card tag editing
    const [editingTagsFor, setEditingTagsFor] = useState(null)
    const [allTags, setAllTags] = useState([])

    const [editingItem, setEditingItem] = useState(null)

    const loadDeck = useCallback(async () => {
        setLoading(true)
        setLoadError('')
        try {
            const response = await decksAPI.get(deckId)
            setDeck(response.data)
        } catch (error) {
            setLoadError(serverMessage(error.originalError || error) || 'Failed to load deck details')
        } finally {
            setLoading(false)
        }
    }, [deckId])

    useEffect(() => {
        loadDeck()
    }, [loadDeck])

    const handleAddQuestion = async (data, tags) => {
        const response = await questionsAPI.create({ ...data, deck_id: Number(deckId) })
        for (const tag of tags) {
            try {
                await tagsAPI.addToQuestion(response.data.id, tag.id)
            } catch (error) {
                console.error('Failed to add tag:', error)
            }
        }
        setShowAddModal(false)
        await loadDeck()
    }

    const handleEditQuestion = async (data) => {
        const response = await questionsAPI.update(editingItem.id, data)
        setDeck(current => ({ ...current, questions: current.questions.map(question =>
            question.id === editingItem.id ? { ...question, ...response.data } : question) }))
        setEditingItem(null)
    }

    const toggleTagEditor = async (questionId) => {
        if (editingTagsFor === questionId) {
            setEditingTagsFor(null)
            return
        }
        setEditingTagsFor(questionId)
        // Reload each time: tags may have been created in the filter panel.
        try {
            const response = await tagsAPI.list(deck.notebook_id)
            setAllTags(response.data)
        } catch (error) {
            console.error('Failed to load tags:', error)
        }
    }

    const setQuestionTags = (questionId, tags) => {
        setDeck(current => ({
            ...current,
            questions: current.questions.map(q => q.id === questionId ? { ...q, tags } : q),
        }))
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
                <Spinner aria-label="Loading deck" className="h-12 w-12" />
            </div>
        )
    }

    if (loadError) return <div className="card">
        <p role="alert">{loadError}</p>
        <button className="btn-primary" onClick={loadDeck}>Try again</button>
    </div>

    if (!deck) return null

    return (
        <div className="max-w-4xl mx-auto px-4">
            {/* Header */}
            <div className="mb-8">
                {!embedded && <button
                    onClick={() => onBack()}
                    className="flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-900 mb-4"
                >
                    <ArrowLeft size={20} className="mr-2" />
                    Back to Decks
                </button>}

                <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{deck.name}</h1>
                        <p className="mt-2 text-gray-600 dark:text-gray-300">{deck.description}</p>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{deck.num_questions} questions</p>
                    </div>
                    <div className="flex gap-3 w-full md:w-auto">
                        <button
                            onClick={() => onPractice(deckId)}
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
                                    onClick={() => onOpenCanvas(document.id)}
                                    className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 transition hover:border-primary-500 hover:text-primary-700 dark:border-gray-600 dark:text-gray-300"
                                >
                                    <Network size={16} />
                                    {document.display_name || document.title || document.filename}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Questions List */}
            <HeldBackQuestions deckId={deckId} onRestored={loadDeck} />
            <div className="glass-panel bg-white rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 dark:bg-gray-800">
                    <div className="flex justify-between items-center">
                        <h2 className="font-semibold text-gray-700 dark:text-gray-200">Cards and questions</h2>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition ${filterTags.length > 0 || showFilters
                                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-200 hover:bg-primary-200'
                                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100'
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
                                notebook_id={deck.notebook_id}
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
                            <div key={question.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition group">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded-full font-medium">
                                                #{index + 1}
                                            </span>
                                            <span className="text-xs">{isFlashcard(question) ? 'Flashcard' : 'Question'}</span>
                                            {question.source_reference?.edited && <span className="text-xs">Edited</span>}
                                            <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${question.difficulty === 'easy' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-200' :
                                                question.difficulty === 'hard' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-200' :
                                                    'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-200'
                                                }`}>
                                                {question.difficulty}
                                            </span>
                                        </div>
                                        <p className="text-gray-900 dark:text-white font-medium mb-2">{isFlashcard(question) && <strong>Front: </strong>}{question.question_text}</p>
                                        {isFlashcard(question) && <details className="mb-2">
                                            <summary className="cursor-pointer">Show back</summary>
                                            <p><strong>Back: </strong>{question.explanation}</p>
                                        </details>}

                                        {/* Tag Badges */}
                                        {editingTagsFor !== question.id && question.tags && question.tags.length > 0 && (
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
                                    <div className="flex items-center gap-1">
                                        <button
                                            aria-label={`Edit item ${index + 1}`}
                                            className="flex min-w-[44px] min-h-[44px] items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
                                            onClick={() => setEditingItem(question)}>
                                            <Pencil size={16} aria-hidden="true" />
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => toggleTagEditor(question.id)}
                                            aria-expanded={editingTagsFor === question.id}
                                            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition ${editingTagsFor === question.id
                                                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-200'
                                                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'}`}
                                        >
                                            <Tag size={16} aria-hidden="true" />
                                            Tags
                                        </button>
                                        <button
                                            onClick={() => handleDeleteQuestion(question.id)}
                                            className="text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 focus:opacity-100 transition p-2"
                                            title="Delete Question"
                                            aria-label="Delete question"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                                {editingItem?.id === question.id && <DeckItemForm notebook_id={deck.notebook_id}
                                    item={editingItem} onSave={handleEditQuestion}
                                    onCancel={() => setEditingItem(null)} />}
                                {editingTagsFor === question.id && (
                                    <QuestionTagEditor
                                        question={question}
                                        allTags={allTags}
                                        onChange={(tags) => setQuestionTags(question.id, tags)}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                        {embedded ? 'No questions in this deck yet. Add one manually or add a source!' : 'No questions in this deck yet. Add one manually or upload a document!'}
                    </div>
                )}
            </div>

            {/* Add Question Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="glass-panel bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add new card</h2>
                            <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6">
                            <DeckItemForm notebook_id={deck.notebook_id} defaultType={deck.kind === 'flashcards' ? 'flashcard' : 'mcq'}
                                onSave={handleAddQuestion} onCancel={() => setShowAddModal(false)} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
