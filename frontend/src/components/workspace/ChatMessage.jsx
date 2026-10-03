import CitationChip from './CitationChip'

function inline(text, citations) {
  return text.split(/(\*\*[\s\S]+?\*\*)/g).map((part, index) => {
    if (/^\*\*[\s\S]+?\*\*$/.test(part)) {
      return <strong key={index}>{citationText(part.slice(2, -2), citations)}</strong>
    }
    return citationText(part, citations)
  })
}

function citationText(text, citations) {
  return text.split(/(\[\d+(?:\s*,\s*\d+)*\])/g).map((part, index) => {
    if (!/^\[\d+(?:\s*,\s*\d+)*\]$/.test(part)) return part
    return part.slice(1, -1).split(',').map((number, offset) => {
      const citation = citations.find(item => item.n === Number(number.trim()))
      return citation ? <CitationChip key={`${index}-${offset}`} citation={citation} /> : null
    })
  })
}

function contentBlocks(content) {
  const blocks = []
  for (const line of content.split('\n')) {
    if (!line.trim()) { blocks.push({ type: 'break' }); continue }
    const bullet = line.match(/^\s*[-*•] (.*)$/)
    const numbered = line.match(/^\d+\. (.*)$/)
    const match = bullet || numbered
    const type = bullet ? 'ul' : numbered ? 'ol' : 'p'
    const previous = blocks[blocks.length - 1]
    if (previous?.type === type) previous.lines.push(match ? match[1] : line)
    else blocks.push({ type, lines: [match ? match[1] : line] })
  }
  return blocks.filter(block => block.type !== 'break')
}

export default function ChatMessage({ message }) {
  const citations = message.role === 'assistant' ? message.citations || [] : []
  const renderText = text => message.role === 'assistant' ? inline(text, citations) : text
  return <article aria-label={`${message.role === 'user' ? 'You' : 'Assistant'} message`}
    className={`chat-message chat-${message.role} ${message.refused ? 'chat-refused' : ''}`}>
    {message.role === 'user' ? <p>{message.content}</p> : contentBlocks(message.content).map((block, index) => {
      if (block.type === 'p') return <p key={index}>{renderText(block.lines.join('\n'))}</p>
      const List = block.type
      return <List key={index}>{block.lines.map((line, offset) => <li key={offset}>{renderText(line)}</li>)}</List>
    })}
    {message.uncited && <p className="chat-note">No citations. Check this answer against your sources.</p>}
  </article>
}
