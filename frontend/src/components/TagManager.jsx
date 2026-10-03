import { serverMessage } from '../utils/serverMessage'
import Spinner from './Spinner'
import { useState, useEffect, useCallback } from 'react'
import { tagsAPI } from '../services/api'
import { Tag, Plus, X } from 'lucide-react'

const PRESET_COLORS = [
    { name: 'blue', value: '#3B82F6', light: '#DBEAFE', text: '#1E40AF' },
    { name: 'green', value: '#10B981', light: '#D1FAE5', text: '#065F46' },
    { name: 'red', value: '#EF4444', light: '#FEE2E2', text: '#991B1B' },
    { name: 'yellow', value: '#F59E0B', light: '#FEF3C7', text: '#92400E' },
    { name: 'purple', value: '#8B5CF6', light: '#EDE9FE', text: '#5B21B6' },
    { name: 'pink', value: '#EC4899', light: '#FCE7F3', text: '#9F1239' },
    { name: 'indigo', value: '#6366F1', light: '#E0E7FF', text: '#3730A3' },
    { name: 'gray', value: '#6B7280', light: '#F3F4F6', text: '#1F2937' },
]

export const TagBadge = ({ tag, onClick, onRemove, size = 'md' }) => {
    const color = PRESET_COLORS.find(c => c.name === tag.color) || PRESET_COLORS[0]
    const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'

    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full font-medium ${sizeClasses} ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
            style={{
                backgroundColor: color.light,
                color: color.text
            }}
            onClick={onClick}
        >
            <Tag size={size === 'sm' ? 12 : 14} />
            {tag.name}
            {tag.shared && <span className="text-xs opacity-75">Shared</span>}
            {onRemove && (
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        onRemove()
                    }}
                    className="hover:bg-black/10 rounded-full p-0.5"
                    aria-label={`Remove ${tag.name}`}
                >
                    <X size={size === 'sm' ? 12 : 14} />
                </button>
            )}
        </span>
    )
}

export default function TagManager({
    notebook_id,
    selectedTags = [],
    onTagsChange,
    mode = 'select' // 'select' or 'manage'
}) {
    const [tags, setTags] = useState([])
    const [loading, setLoading] = useState(true)
    const [writeError, setWriteError] = useState('')
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [newTagName, setNewTagName] = useState('')
    const [newTagColor, setNewTagColor] = useState('blue')
    const [pendingDelete, setPendingDelete] = useState(null)

    const loadTags = useCallback(async () => {
        try {
            const response = await tagsAPI.list(notebook_id)
            setTags(response.data)
        } catch (error) {
            console.error('Failed to load tags:', error)
        } finally {
            setLoading(false)
        }
    }, [notebook_id])

    useEffect(() => {
        loadTags()
    }, [loadTags])

    const handleCreateTag = async () => {
        if (!newTagName.trim()) {
            alert('Tag name is required')
            return
        }

        try {
            const response = await tagsAPI.create({
                name: newTagName.trim(),
                color: newTagColor,
                ...(notebook_id != null ? { notebook_id } : {})
            })
            setTags([...tags, response.data])
            setNewTagName('')
            setNewTagColor('blue')
            setShowCreateForm(false)

            // Auto-select newly created tag if in select mode
            if (mode === 'select' && onTagsChange) {
                onTagsChange([...selectedTags, response.data])
            }
        } catch (error) {
            console.error('Failed to create tag:', error)
            setWriteError(serverMessage(error.originalError || error) || error.message || 'Failed to create tag')
        }
    }

    const handleDeleteTag = async (tagId) => {
        try {
            await tagsAPI.delete(tagId)
            setPendingDelete(null)
            setTags(tags.filter(t => t.id !== tagId))

            // Remove from selected tags if present
            if (onTagsChange && selectedTags.some(t => t.id === tagId)) {
                onTagsChange(selectedTags.filter(t => t.id !== tagId))
            }
        } catch (error) {
            console.error('Failed to delete tag:', error)
            setWriteError(serverMessage(error.originalError || error) || 'Failed to delete tag')
        }
    }

    const requestDelete = async (tag) => {
        try {
            const response = await tagsAPI.get(tag.id)
            setPendingDelete(response.data)
        } catch (error) {
            console.error('Failed to load tag:', error)
            alert('Failed to load tag')
        }
    }

    const toggleTagSelection = (tag) => {
        if (!onTagsChange) return

        const isSelected = selectedTags.some(t => t.id === tag.id)
        if (isSelected) {
            onTagsChange(selectedTags.filter(t => t.id !== tag.id))
        } else {
            onTagsChange([...selectedTags, tag])
        }
    }

    if (loading) {
        return (
            <div className="flex justify-center py-4">
                <Spinner aria-label="Loading tags" className="h-6 w-6" />
            </div>
        )
    }

    return (
        <div className="space-y-3">
            {writeError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{writeError}</p>}
            {pendingDelete && (
                <div role="dialog" aria-label="Delete tag" className="rounded-lg border p-3 space-y-2">
                    <p>{pendingDelete.shared
                        ? `This tag is shared by every notebook. Remove it from ${pendingDelete.question_count} questions everywhere?`
                        : 'Delete this tag? It will be removed from all questions.'}</p>
                    <button type="button" onClick={() => handleDeleteTag(pendingDelete.id)}>Remove tag</button>
                    <button type="button" onClick={() => setPendingDelete(null)}>Cancel</button>
                </div>
            )}
            {/* Tag List */}
            <div className="flex flex-wrap gap-2">
                {tags.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">No tags yet. Create one below!</p>
                ) : (
                    tags.map(tag => (
                        <TagBadge
                            key={tag.id}
                            tag={tag}
                            onClick={mode === 'select' ? () => toggleTagSelection(tag) : undefined}
                            onRemove={mode === 'manage' ? () => requestDelete(tag) : undefined}
                            size="md"
                        />
                    ))
                )}
            </div>

            {/* Selected Tags Display (in select mode) */}
            {mode === 'select' && selectedTags.length > 0 && (
                <div className="bg-primary-50 rounded-lg p-3 border border-primary-100">
                    <p className="text-xs font-medium text-gray-700 mb-2">Selected Tags:</p>
                    <div className="flex flex-wrap gap-2">
                        {selectedTags.map(tag => (
                            <TagBadge
                                key={tag.id}
                                tag={tag}
                                onRemove={() => toggleTagSelection(tag)}
                                size="sm"
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Create Tag Form */}
            {showCreateForm ? (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-3">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Tag Name
                        </label>
                        <input
                            type="text"
                            value={newTagName}
                            onChange={(e) => setNewTagName(e.target.value)}
                            placeholder="e.g., Important, Review, Chapter 1"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                            onKeyPress={(e) => e.key === 'Enter' && handleCreateTag()}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Color
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {PRESET_COLORS.map(color => (
                                <button
                                    key={color.name}
                                    onClick={() => setNewTagColor(color.name)}
                                    className={`w-8 h-8 rounded-full border-2 transition ${newTagColor === color.name
                                            ? 'border-gray-900 scale-110'
                                            : 'border-gray-300 hover:scale-105'
                                        }`}
                                    style={{ backgroundColor: color.value }}
                                    title={color.name}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleCreateTag}
                            className="flex-1 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition flex items-center justify-center gap-2"
                        >
                            <Plus size={18} />
                            Create Tag
                        </button>
                        <button
                            onClick={() => {
                                setShowCreateForm(false)
                                setNewTagName('')
                                setNewTagColor('blue')
                            }}
                            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    onClick={() => setShowCreateForm(true)}
                    className="w-full border-2 border-dashed border-gray-300 rounded-lg px-4 py-2 text-gray-600 hover:border-primary-400 hover:text-primary-600 transition flex items-center justify-center gap-2"
                >
                    <Plus size={18} />
                    Create New Tag
                </button>
            )}
        </div>
    )
}
