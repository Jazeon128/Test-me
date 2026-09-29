import { useState } from 'react'
import { Check, Plus, Sparkles, X } from 'lucide-react'
import { questionsAPI, tagsAPI } from '../services/api'
import { TagBadge } from './TagManager'

/**
 * Edit the tags on one saved question.
 *
 * Tags are applied by hand from the existing list, or suggested by System One
 * and accepted one at a time. Nothing is applied without a click, and every
 * change is saved immediately through the tag assignment API.
 */
// The server's empty list means "no tag fits". A list emptied by accepting or
// dismissing means the user is done, so it collapses instead of saying that.
function withoutHandled(current, isHandled) {
    if (!current) return current
    const remaining = current.filter(item => !isHandled(item))
    return remaining.length ? remaining : null
}

export default function QuestionTagEditor({ question, allTags, onChange }) {
    const [suggestions, setSuggestions] = useState(null)
    const [reason, setReason] = useState('')
    const [suggesting, setSuggesting] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')

    const applied = question.tags || []
    const appliedIds = new Set(applied.map(tag => tag.id))
    const unapplied = allTags.filter(tag => !appliedIds.has(tag.id))

    // Adds in order and reports the final list once, so "Apply all" does not
    // overwrite one add with another built from a stale list.
    const addTags = async (tags) => {
        setBusy(true)
        setError('')
        const added = []
        try {
            for (const tag of tags) {
                await tagsAPI.addToQuestion(question.id, tag.id)
                added.push(tag)
            }
        } catch (err) {
            setError(err.message || 'Could not add the tag.')
        } finally {
            if (added.length) {
                const addedIds = new Set(added.map(tag => tag.id))
                onChange([...applied, ...added])
                setSuggestions(current => withoutHandled(current, item => addedIds.has(item.id)))
            }
            setBusy(false)
        }
    }

    const removeTag = async (tag) => {
        setBusy(true)
        setError('')
        try {
            await tagsAPI.removeFromQuestion(question.id, tag.id)
            onChange(applied.filter(item => item.id !== tag.id))
        } catch (err) {
            setError(err.message || `Could not remove ${tag.name}.`)
        } finally {
            setBusy(false)
        }
    }

    const suggest = async () => {
        setSuggesting(true)
        setError('')
        setReason('')
        try {
            const response = await questionsAPI.suggestTags(question.id)
            setSuggestions(response.data.suggested)
            setReason(response.data.reason || '')
        } catch (err) {
            setError(err.message || 'Could not load suggestions.')
        } finally {
            setSuggesting(false)
        }
    }

    const dismiss = (tag) => setSuggestions(current => withoutHandled(current, item => item.id === tag.id))

    return (
        <div className="mt-3 space-y-3 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <div className="flex flex-wrap items-center gap-2">
                {applied.length > 0 ? (
                    applied.map(tag => (
                        <TagBadge key={tag.id} tag={tag} size="sm"
                            onRemove={busy ? undefined : () => removeTag(tag)} />
                    ))
                ) : (
                    <span className="text-sm text-gray-500 dark:text-gray-400">No tags on this card.</span>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
                {unapplied.length > 0 && (
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                        <Plus size={14} aria-hidden="true" />
                        <select
                            aria-label="Add a tag"
                            className="input-field !min-h-0 !w-auto py-1 text-sm"
                            value=""
                            disabled={busy}
                            onChange={(event) => {
                                const tag = unapplied.find(item => item.id === Number(event.target.value))
                                if (tag) addTags([tag])
                            }}
                        >
                            <option value="">Add a tag…</option>
                            {unapplied.map(tag => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
                        </select>
                    </label>
                )}
                <button
                    type="button"
                    onClick={suggest}
                    disabled={suggesting}
                    className="btn-secondary inline-flex !min-h-0 py-1.5 text-sm"
                >
                    <Sparkles size={14} aria-hidden="true" />
                    {suggesting ? 'Checking…' : 'Suggest tags'}
                </button>
            </div>

            {suggestions && suggestions.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Suggested</p>
                        {suggestions.length > 1 && (
                            <button type="button" onClick={() => addTags(suggestions)} disabled={busy}
                                className="text-sm font-medium text-primary-700 hover:underline dark:text-primary-300">
                                Apply all
                            </button>
                        )}
                    </div>
                    <ul className="flex flex-wrap gap-2">
                        {suggestions.map(tag => (
                            <li key={tag.id} className="inline-flex items-center gap-1 rounded-full border border-dashed border-primary-400 py-0.5 pl-3 pr-1 text-sm text-gray-800 dark:text-gray-100">
                                {tag.name}
                                <span className="text-xs text-gray-500 dark:text-gray-400">{Math.round(tag.probability * 100)}%</span>
                                <button type="button" onClick={() => addTags([tag])} disabled={busy}
                                    aria-label={`Apply ${tag.name}`}
                                    className="rounded-full p-1 text-green-700 hover:bg-green-100 dark:text-green-300 dark:hover:bg-green-900/30">
                                    <Check size={14} />
                                </button>
                                <button type="button" onClick={() => dismiss(tag)}
                                    aria-label={`Dismiss ${tag.name}`}
                                    className="rounded-full p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700">
                                    <X size={14} />
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {suggestions && suggestions.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    {reason || 'None of your tags fit this card.'}
                </p>
            )}

            {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
        </div>
    )
}
