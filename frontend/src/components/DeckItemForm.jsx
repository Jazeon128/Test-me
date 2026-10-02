import { useEffect, useRef, useState } from 'react'
import TagManager from './TagManager'
import { serverMessage } from '../utils/serverMessage'

function isFlashcard(item) {
    return item.card_type === 'flashcard' || (item.options?.length === 1 &&
        item.options[0].text === 'Flip to see answer')
}

export default function DeckItemForm({ item, notebook_id, defaultType = 'mcq', onSave, onCancel }) {
    const [type, setType] = useState(item ? (isFlashcard(item) ? 'flashcard' : 'mcq') : defaultType)
    const [front, setFront] = useState(item?.question_text || '')
    const [back, setBack] = useState(item?.explanation || '')
    const [difficulty, setDifficulty] = useState(item?.difficulty || 'medium')
    const [options, setOptions] = useState(item && !isFlashcard(item) ? item.options :
        Array.from({ length: 4 }, (_, index) => ({ text: '', is_correct: index === 0 })))
    const [tags, setTags] = useState([])
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)
    const flashcard = type === 'flashcard'
    const frontInput = useRef(null)

    useEffect(() => { frontInput.current?.focus() }, [])

    const submit = async event => {
        event.preventDefault()
        if (!front.trim()) return setError(flashcard ? 'Front is required' : 'Question is required')
        if (flashcard && (front.length > 200 || !back.trim() || back.length > 600)) {
            return setError('Front must be 1 to 200 characters. Back must be 1 to 600 characters.')
        }
        if (!flashcard && (options.length !== 4 || options.some(option => !option.text.trim()) ||
            options.filter(option => option.is_correct).length !== 1)) {
            return setError('Supply four options with text and exactly one correct answer.')
        }
        setError('')
        setSaving(true)
        try {
            const data = { question_text: front, explanation: back, difficulty }
            if (!item) data.card_type = type
            if (!flashcard) data.options = options.map(({ text, is_correct }) => ({ text, is_correct }))
            await onSave(data, tags)
        } catch (failure) {
            setError(serverMessage(failure.originalError || failure) || 'Failed to save item')
        } finally {
            setSaving(false)
        }
    }

    return <form className="space-y-4 mt-4" onSubmit={submit} onKeyDown={event => {
        if (event.key === 'Escape' && !saving) {
            event.preventDefault()
            onCancel()
        }
    }}>
        {!item && <label className="block text-gray-700 dark:text-gray-200">Type
            <select className="input-field" aria-label="Type" value={type} onChange={event => setType(event.target.value)}>
                <option value="mcq">Question</option>
                <option value="flashcard">Flashcard</option>
            </select>
        </label>}
        <label className="block text-gray-700 dark:text-gray-200">{flashcard ? 'Front' : 'Question'}
            <textarea ref={frontInput} className="input-field" value={front}
                onChange={event => setFront(event.target.value)} />
        </label>
        {!flashcard && <fieldset>
            <legend className="text-gray-700 dark:text-gray-200">Options (Select correct answer)</legend>
            {options.map((option, index) => <div key={index} className="flex gap-3 my-2">
                <input className="h-4 w-4 border-gray-300 bg-white text-primary-600 dark:border-gray-600 dark:bg-gray-700 dark:text-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800" type="radio" name={`correct-${item?.id || 'new'}`}
                    aria-label={`Correct answer ${String.fromCharCode(65 + index)}`}
                    checked={option.is_correct} onChange={() => setOptions(current => current.map(
                        (value, position) => ({ ...value, is_correct: position === index })))} />
                <label className="text-gray-700 dark:text-gray-200">Option {String.fromCharCode(65 + index)}
                    <input className="input-field" value={option.text}
                        onChange={event => setOptions(current => current.map((value, position) =>
                            position === index ? { ...value, text: event.target.value } : value))} />
                </label>
            </div>)}
        </fieldset>}
        <label className="block text-gray-700 dark:text-gray-200">{flashcard ? 'Back' : 'Explanation'}
            <textarea className="input-field" value={back}
                onChange={event => setBack(event.target.value)} />
        </label>
        <label className="block text-gray-700 dark:text-gray-200">Difficulty
            <select className="input-field" value={difficulty} onChange={event => setDifficulty(event.target.value)}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
            </select>
        </label>
        {!item && <TagManager notebook_id={notebook_id} selectedTags={tags} onTagsChange={setTags} mode="select" />}
        {error && <p role="alert" className="workspace-error">{error}</p>}
        <div className="flex gap-3">
            <button type="submit" className="btn-primary" disabled={saving}>{item ? 'Save' : 'Save Card'}</button>
            <button type="button" className="btn-secondary" disabled={saving} onClick={onCancel}>Cancel</button>
        </div>
    </form>
}
