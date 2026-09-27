import PropTypes from 'prop-types'

/**
 * A small character that reflects your streak.
 *
 * Deliberately not a guilt mechanic. There is no sad state and no state that
 * blames you for a missed day: a character that sulks to make you open an app
 * is a manipulation pattern. The resting face is calm, and everything above it
 * is earned upward. The worst it ever does is sit quietly.
 *
 * Drawn inline rather than shipped as an asset so it inherits the theme.
 */

const FACES = {
  // eyes, mouth path, and how awake the character looks
  new: { eye: 3, mouth: 'M 26 40 Q 32 42 38 40', glow: 0 },
  resting: { eye: 2.2, mouth: 'M 26 40 L 38 40', glow: 0 },
  warm: { eye: 3, mouth: 'M 26 39 Q 32 44 38 39', glow: 0.2 },
  happy: { eye: 3.4, mouth: 'M 25 38 Q 32 46 39 38', glow: 0.45 },
  thriving: { eye: 3.6, mouth: 'M 24 38 Q 32 48 40 38', glow: 0.7 },
  radiant: { eye: 3.8, mouth: 'M 24 37 Q 32 49 40 37', glow: 1 },
}

export default function Mascot({ mood, size = 64, showLine = true }) {
  const state = mood?.state || 'new'
  const face = FACES[state] || FACES.new
  const sleeping = state === 'resting'

  return (
    <div className="flex items-center gap-3">
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        role="img"
        aria-label={`Study companion, ${state}. ${mood?.line || ''}`}
        className="flex-none"
      >
        {face.glow > 0 && (
          <circle
            cx="32"
            cy="32"
            r="30"
            className="fill-primary-500"
            opacity={face.glow * 0.16}
          />
        )}

        <circle cx="32" cy="34" r="20" className="fill-primary-600 dark:fill-primary-500" />

        {/* ears */}
        <path d="M 16 20 L 20 34 L 28 26 Z" className="fill-primary-700 dark:fill-primary-600" />
        <path d="M 48 20 L 44 34 L 36 26 Z" className="fill-primary-700 dark:fill-primary-600" />

        {/* muzzle */}
        <ellipse cx="32" cy="40" rx="11" ry="8" className="fill-white/90 dark:fill-gray-100/90" />

        {sleeping ? (
          <>
            <path
              d="M 22 33 Q 25 31 28 33"
              className="stroke-gray-900 dark:stroke-gray-900"
              strokeWidth="1.8"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M 36 33 Q 39 31 42 33"
              className="stroke-gray-900 dark:stroke-gray-900"
              strokeWidth="1.8"
              fill="none"
              strokeLinecap="round"
            />
          </>
        ) : (
          <>
            <circle cx="25" cy="32" r={face.eye} className="fill-gray-900" />
            <circle cx="39" cy="32" r={face.eye} className="fill-gray-900" />
          </>
        )}

        <circle cx="32" cy="37" r="2" className="fill-gray-900" />
        <path
          d={face.mouth}
          className="stroke-gray-900"
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
        />
      </svg>

      {showLine && (
        <div>
          <div className="font-medium text-gray-900 dark:text-white">
            {mood?.streak > 0
              ? `${mood.streak} day${mood.streak === 1 ? '' : 's'}`
              : 'No run yet'}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">{mood?.line}</div>
        </div>
      )}
    </div>
  )
}

Mascot.propTypes = {
  mood: PropTypes.object,
  size: PropTypes.number,
  showLine: PropTypes.bool,
}
