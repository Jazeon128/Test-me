const levels = ['not_started', 'attempted', 'familiar', 'proficient', 'mastered']
const unaided = attempt => Boolean(attempt.correct && !attempt.hinted)
const utcDay = date => date ? new Date(date).toISOString().slice(0, 10) : null

// Mirrors backend/app/services/mastery.py. Histories contain one entry per question.
export function topicMastery(histories) {
  const attempted = histories.filter(history => history.length)
    .map(history => [...history].sort((a, b) => Date.parse(a.date || 0) - Date.parse(b.date || 0)))
  const attempted_count = attempted.length
  const correct_count = attempted.filter(history => unaided(history.at(-1))).length
  const accuracy = attempted_count ? correct_count / attempted_count : 0
  const repeated = attempted.every(history => history.length >= 2 && history.slice(-2).every(unaided)
    && utcDay(history.at(-1).date) && utcDay(history.at(-2).date)
    && utcDay(history.at(-1).date) !== utcDay(history.at(-2).date))
  const level = !attempted_count ? 'not_started' : accuracy < 0.70 ? 'attempted'
    : accuracy < 1 || attempted_count < Math.min(4, histories.length) ? 'familiar'
      : repeated ? 'mastered' : 'proficient'
  return { attempted_count, correct_count, level }
}

export function sessionMastery(recorded, answers, routes) {
  if (recorded && !recorded.topics.some(topic => topic.question_ids?.some(id => answers.has(id)))) return recorded
  const topics = (recorded?.topics || []).map(topic => {
    if (!topic.question_ids?.some(id => answers.has(id))) return { ...topic }
    // The snapshot exposes aggregate counts, not full answer histories. Preserve
    // those counts as baseline answers. Prefer recorded per-question progress to
    // identify attempted questions. Unknown dates cannot prove repeated mastery.
    const ids = [...topic.question_ids].sort((a, b) =>
      Number(Boolean(routes[`GET /progress/question/${b}`]?.times_seen))
      - Number(Boolean(routes[`GET /progress/question/${a}`]?.times_seen)))
    const histories = ids.map((id, index) => {
      const progress = routes[`GET /progress/question/${id}`]
      const baseline = progress?.attempt_history || (index < topic.attempted_count
        ? [{ date: progress?.last_attempt_date || null, correct: index < topic.correct_count, hinted: false }] : [])
      return [...baseline, ...(answers.get(id) || [])]
    })
    return { ...topic, ...topicMastery(histories) }
  })
  const counts = Object.fromEntries(levels.map(level => [level, 0]))
  topics.forEach(topic => { counts[topic.level]++ })
  return { topics, summary: { topic_count: topics.length,
    proficient_or_above: counts.proficient + counts.mastered, levels: counts } }
}
