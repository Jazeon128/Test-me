import PropTypes from 'prop-types'
import { formatPassage, passageBlocks } from '../utils/passage'

const cellStyle = { border: '1px solid var(--line)', padding: '6px 10px', textAlign: 'left' }

export default function PassageText({ text }) {
  return <>{passageBlocks(text).map((block, index) => block.type === 'table'
    ? <div key={index} className="my-2 max-w-full overflow-x-auto">
      <table className="text-sm" style={{ borderCollapse: 'collapse', color: 'var(--text2)', width: 'max-content', minWidth: '100%' }}>
        <thead style={{ color: 'var(--text)' }}><tr>{block.header.map((cell, column) =>
          <th key={column} scope="col" style={cellStyle}>{cell}</th>)}</tr></thead>
        <tbody>{block.rows.map((row, ordinal) => <tr key={ordinal}>{row.map((cell, column) =>
          <td key={column} style={cellStyle}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
    : <p key={index}>{formatPassage(block.text)}</p>)}</>
}

PassageText.propTypes = { text: PropTypes.string }
