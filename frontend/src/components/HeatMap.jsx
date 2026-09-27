import { useEffect, useRef } from 'react'
import PropTypes from 'prop-types'

/**
 * A year of study days.
 *
 * Weeks are columns, weekdays are rows, the same shape as a contribution graph,
 * because that layout is already legible to most people without a legend.
 */

const WEEKDAYS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun']

/** Five buckets. Intensity is relative to the person's own busiest day. */
function level(answered, busiest) {
  if (!answered) return 0
  if (busiest <= 1) return 4
  const share = answered / busiest
  if (share > 0.75) return 4
  if (share > 0.5) return 3
  if (share > 0.25) return 2
  return 1
}

const FILLS = [
  'bg-gray-200 dark:bg-gray-800',
  'bg-primary-200 dark:bg-primary-900',
  'bg-primary-300 dark:bg-primary-800',
  'bg-primary-500 dark:bg-primary-600',
  'bg-primary-600 dark:bg-primary-400',
]

export default function HeatMap({ days }) {
  const scroller = useRef(null)

  // A year of weeks overflows, and the interesting end is the recent one. Open
  // scrolled to today rather than to a year ago.
  useEffect(() => {
    if (scroller.current) {
      scroller.current.scrollLeft = scroller.current.scrollWidth
    }
  }, [days])

  if (!days?.length) return null

  const busiest = Math.max(...days.map((d) => d.questions_answered), 0)

  // Pad the start so the first column begins on a Monday.
  const firstWeekday = (new Date(days[0].date).getDay() + 6) % 7
  const cells = [...Array(firstWeekday).fill(null), ...days]

  const weeks = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }

  const activeDays = days.filter((d) => d.questions_answered > 0).length

  return (
    <div>
      <div className="flex gap-2">
        {/* Outside the scroller, so the labels stay put while the weeks move. */}
        <div className="flex flex-none flex-col gap-1 pt-0.5">
          {WEEKDAYS.map((label, index) => (
            <span
              key={index}
              className="h-3 text-[10px] leading-3 text-gray-400 dark:text-gray-500"
              style={{ width: 24 }}
            >
              {label}
            </span>
          ))}
        </div>

        <div ref={scroller} className="flex gap-1 overflow-x-auto pb-2">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-1">
              {week.map((day, dayIndex) =>
                day ? (
                  <div
                    key={day.date}
                    className={`h-3 w-3 rounded-sm ${FILLS[level(day.questions_answered, busiest)]}`}
                    title={
                      day.questions_answered
                        ? `${day.date}: ${day.questions_answered} answered, ${day.questions_correct} correct`
                        : `${day.date}: nothing`
                    }
                  />
                ) : (
                  <div key={`pad-${weekIndex}-${dayIndex}`} className="h-3 w-3" />
                )
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>
          {activeDays} active {activeDays === 1 ? 'day' : 'days'}
        </span>
        <span className="flex items-center gap-1">
          Less
          {FILLS.map((fill, index) => (
            <span key={index} className={`h-3 w-3 rounded-sm ${fill}`} />
          ))}
          More
        </span>
      </div>
    </div>
  )
}

HeatMap.propTypes = {
  days: PropTypes.arrayOf(PropTypes.object),
}
