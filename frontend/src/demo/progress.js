// Session-only progress. SM-2 follows backend/app/services/spaced_repetition.
export function createProgress(routes, questions) {
  const tracked = new Map()
  let currentStreak = routes['GET /progress/stats']?.current_streak || 0
  let bestStreak = routes['GET /progress/stats']?.best_streak || 0
  const baseline = id => routes[`GET /progress/question/${id}`] || { question_id: id, never_seen: true }
  const due = row => Boolean(row.next_review_date && Date.parse(row.next_review_date) <= Date.now())
  const delta = (row, field) => row[field] - (baseline(row.question_id)[field] || 0)
  const dueDelta = rows => rows.reduce((sum, row) => sum + Number(due(row)) - Number(due(baseline(row.question_id))), 0)
  const masteredDelta = rows => rows.reduce((sum, row) => sum + Number(row.is_mastered) - Number(Boolean(baseline(row.question_id).is_mastered)), 0)
  const question = id => tracked.get(id) || routes[`GET /progress/question/${id}`] || { question_id: id, never_seen: true }
  const stats = () => {
    const base = { ...(routes['GET /progress/stats'] || {}) }
    const rows = [...tracked.values()]
    const attempts = rows.reduce((sum, row) => sum + delta(row, 'times_seen'), 0)
    const correct = rows.reduce((sum, row) => sum + delta(row, 'times_correct'), 0)
    const originalAttempts = base.total_attempts || 0
    return { ...base, total_questions_seen: (base.total_questions_seen || 0) + rows.filter(row => row.was_new).length,
      total_attempts: originalAttempts + attempts,
      overall_success_rate: (originalAttempts * (base.overall_success_rate || 0) + correct) / (originalAttempts + attempts || 1),
      questions_due: Math.max(0, (base.questions_due || 0) + dueDelta(rows)),
      questions_mastered: (base.questions_mastered || 0) + masteredDelta(rows),
      current_streak: currentStreak, best_streak: Math.max(base.best_streak || 0, bestStreak) }
  }
  const byNotebook = () => (routes['GET /progress/stats/by-notebook'] || []).map(row => {
    const ids = routes[`GET /notebooks/${row.notebook_id}/questions`]?.items.map(item => item.id) || []
    const rows = [...tracked.values()].filter(item => ids.includes(item.question_id))
    const attempts = rows.reduce((sum, item) => sum + delta(item, 'times_seen'), 0)
    const correct = rows.reduce((sum, item) => sum + delta(item, 'times_correct'), 0)
    return { ...row, questions_seen: row.questions_seen + rows.filter(item => item.was_new).length,
      total_attempts: row.total_attempts + attempts,
      success_rate: (row.total_attempts * row.success_rate + correct) / (row.total_attempts + attempts || 1),
      questions_due: Math.max(0, row.questions_due + dueDelta(rows)),
      questions_mastered: row.questions_mastered + masteredDelta(rows),
      mastery_rate: (row.questions_mastered + masteredDelta(rows)) / (row.total_questions || 1),
      last_studied: rows.length ? rows[rows.length - 1].last_attempt_date : row.last_studied }
  })
  const submit = body => {
    const item = questions.find(item => item.id === body.question_id)
    if (!item) return { status: 404, data: { detail: 'Not part of the demo.' } }
    const flashcard = item.card_type === 'flashcard'
    if (flashcard && (!Number.isInteger(body.manual_quality) || body.manual_quality < 0 || body.manual_quality > 5 || body.selected_option || body.retry_allowed || body.after_feedback || body.hint_used)) {
      return { status: 422, data: { detail: 'Rate this card.' } }
    }
    const correctOption = flashcard ? null : item.options.find(option => option.is_correct)?.option
    const correct = flashcard ? body.manual_quality >= 3 : Boolean(correctOption && correctOption === (body.selected_option || '').toUpperCase())
    const previous = tracked.get(item.id)
    const initial = baseline(item.id)
    const row = previous || { question_id: item.id, times_seen: 0, times_correct: 0, times_incorrect: 0,
      streak: 0, best_streak: 0, average_time_seconds: 0, ef: 2.5, repetitions: 0, interval_days: 0,
      ...Object.fromEntries(['times_seen', 'times_correct', 'times_incorrect', 'streak', 'best_streak', 'average_time_seconds'].map(field => [field, initial[field] || 0])),
      was_new: !initial.times_seen }
    row.average_time_seconds = (row.average_time_seconds * row.times_seen + (body.time_taken_seconds || 0)) / (row.times_seen + 1)
    row.times_seen++
    row.times_correct += Number(correct)
    row.times_incorrect += Number(!correct)
    row.success_rate = row.times_correct / row.times_seen
    row.streak = correct ? row.streak + 1 : 0
    row.best_streak = Math.max(row.best_streak, row.streak)
    currentStreak = correct ? currentStreak + 1 : 0
    bestStreak = Math.max(bestStreak, currentStreak)
    let quality = body.manual_quality ?? (correct ? (body.time_taken_seconds <= 15 ? 5 : body.time_taken_seconds <= 24 ? 4 : 3) : body.time_taken_seconds < 15 ? 2 : 1)
    if (body.hint_used && correct) quality = Math.min(quality, 3)
    if (!flashcard && body.time_taken_seconds > 30) quality = Math.max(0, quality - 1)
    row.ef = Math.max(1.3, row.ef + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    row.repetitions = quality < 3 ? 0 : row.repetitions + 1
    row.interval_days = row.repetitions <= 1 ? 1 : row.repetitions === 2 ? 6 : Math.round(row.interval_days * row.ef)
    row.next_review_date = new Date(Date.now() + row.interval_days * 86400000).toISOString()
    row.last_attempt_date = new Date().toISOString()
    row.is_mastered = row.repetitions >= 5 && row.ef >= 2.5 && row.success_rate >= 0.8
    row.mastery_percentage = Math.min(100, Math.trunc(row.repetitions / 10 * 30 + (row.ef - 1.3) / 1.2 * 35 + row.success_rate * 35))
    tracked.set(item.id, row)
    const publicProgress = { ...row }
    for (const field of ['ef', 'repetitions', 'was_new', 'question_id', 'last_attempt_date']) delete publicProgress[field]
    return { status: 200, data: { retry: false, written_grade: null, correct, correct_answer: correctOption,
      explanation: item.explanation, source_reference: item.source_reference,
      progress: publicProgress, gamification: { points_earned: correct ? 10 : 2, streak_bonus: 0,
        points_total: correct ? 10 : 2, daily_streak: 1, mastery_achieved: false, awards: [] } } }
  }
  return { submit, stats, byNotebook,
    question: id => {
      if (!tracked.has(id)) return question(id)
      const row = question(id)
      return Object.fromEntries(['question_id', 'times_seen', 'times_correct', 'times_incorrect', 'success_rate',
        'average_time_seconds', 'streak', 'best_streak', 'is_mastered', 'mastery_percentage', 'next_review_date']
        .map(field => [field, row[field]]).concat([['is_due', due(row)]]))
    },
    eligible: (id, body) => question(id).times_seen ? body.include_review !== false && due(question(id)) : body.include_new !== false,
    bankItem: item => tracked.has(item.id) ? { ...item, times_seen: question(item.id).times_seen,
      times_correct: question(item.id).times_correct, next_review_date: question(item.id).next_review_date,
      status: due(question(item.id)) ? 'due' : question(item.id).is_mastered ? 'mastered' : 'learning' } : item,
    workspace: data => {
      const row = byNotebook().find(row => row.notebook_id === data.notebook.id)
      if (row) data.progress = { ...data.progress, answered_count: row.questions_seen, correct_rate: row.total_attempts ? row.success_rate : null, due_count: row.questions_due }
      for (const deck of data.artifacts.decks) {
        const ids = routes[`GET /decks/${deck.id}`]?.questions.map(item => item.id) || []
        deck.new_count = Math.max(0, deck.new_count - ids.filter(id => tracked.get(id)?.was_new).length)
        deck.due_count = Math.max(0, deck.due_count + dueDelta([...tracked.values()].filter(item => ids.includes(item.question_id))))
      }
    } }
}
