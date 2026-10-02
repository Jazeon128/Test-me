import { Handle, Position } from '@xyflow/react'
import { FileText, AlertCircle } from 'lucide-react'
import PropTypes from 'prop-types'
import NodeEditor, { EditedMarker } from './NodeEditor'

/**
 * The node types the canvas draws.
 *
 * One shape-and-colour language is reused across all twelve templates, so a
 * fishbone and an architecture diagram read as the same application. What
 * changes per template is which of these types is used and what the small
 * caption above the label says.
 */

const COLORS = ['blue', 'teal', 'amber', 'violet', 'rose', 'slate']

const colorClass = (color) => `c-${COLORS.includes(color) ? color : 'slate'}`

/**
 * The citation affordance every node carries.
 *
 * A node whose citation did not resolve says so rather than showing a chip that
 * leads nowhere. The canvas promises every node traces back to the source, so a
 * node that cannot must be visibly the exception.
 */
function Cite({ sectionId, active, onOpen }) {
  if (!sectionId) {
    return (
      <span className="tm-cite is-missing" title="No source passage for this node">
        <AlertCircle size={10} />
        <span>no source</span>
      </span>
    )
  }

  return (
    <button
      type="button"
      className={`tm-cite${active ? ' is-active' : ''}`}
      onClick={(event) => {
        event.stopPropagation()
        onOpen?.()
      }}
      aria-label={`Show the source passage for this node (${sectionId})`}
    >
      <FileText size={10} />
      <span className="tm-mono">{sectionId}</span>
    </button>
  )
}

Cite.propTypes = {
  sectionId: PropTypes.string,
  active: PropTypes.bool,
  onOpen: PropTypes.func,
}

function NodeShell({ data, selected, shape = 'rect', caption, detail = true }) {
  return (
    <div
      className={`tm-node shape-${shape} ${colorClass(data.color)}${selected ? ' is-selected' : ''}`}
    >
      <Handle type="target" position={Position.Left} />
      <div className="tm-node-head">
        <span className="tm-sw" />
        <span className="tm-kind">{caption}</span>
        <Cite sectionId={data.source_section_id} active={selected} onOpen={data.onOpenSource} />
        <EditedMarker data={data} />
      </div>
      {data.editing ? (
        <NodeEditor data={data} detail={detail} />
      ) : (
        <>
          <div className="tm-label">{data.label}</div>
          {data.detail ? <div className="tm-detail">{data.detail}</div> : null}
        </>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

NodeShell.propTypes = {
  data: PropTypes.object.isRequired,
  selected: PropTypes.bool,
  shape: PropTypes.string,
  caption: PropTypes.string,
  detail: PropTypes.bool,
}

/** A step in a process, a state, or an idea. The default node. */
export function StepNode({ data, selected }) {
  const kind = data.kind || 'step'
  const shape = kind === 'decision' ? 'hex' : kind === 'start' || kind === 'end' ? 'pill' : 'rect'
  return <NodeShell data={data} selected={selected} shape={shape} caption={kind} />
}

/** A component in an architecture or context diagram. */
export function ServiceNode({ data, selected }) {
  return (
    <NodeShell
      data={data}
      selected={selected}
      shape="rect"
      caption={data.category || data.kind || 'service'}
    />
  )
}

/** A dated event on a timeline. */
export function MilestoneNode({ data, selected }) {
  return <NodeShell data={data} selected={selected} shape="pill" caption={data.when || 'when'} />
}

/** One rib of a fishbone: a cause written on the bone, not in a box. */
export function BoneNode({ data, selected }) {
  return (
    <div className={`tm-bone${selected ? ' is-selected' : ''}`}>
      <Handle type="source" position={Position.Right} />
      {data.editing ? <NodeEditor data={data} /> : <span>{data.label}</span>}
      <Cite sectionId={data.source_section_id} active={selected} onOpen={data.onOpenSource} />
      <EditedMarker data={data} />
    </div>
  )
}

/** One cell of a comparison matrix. */
export function MatrixCell({ data, selected }) {
  const verdictColor = { good: 'teal', mixed: 'amber', poor: 'rose', neutral: 'slate' }
  return (
    <NodeShell
      data={{ ...data, color: verdictColor[data.verdict] || 'slate' }}
      selected={selected}
      shape="rect"
      detail={false}
      caption={data.criterion}
    />
  )
}

/** A labelled container: dashed for a group, solid for a boundary. */
export function GroupNode({ data }) {
  return (
    <div className={`tm-group${data.kind === 'boundary' ? ' is-boundary' : ''}`}>
      <EditedMarker data={data} />
      {data.editing ? <NodeEditor data={data} /> : <div className="tm-group-label">{data.label}</div>}
    </div>
  )
}

const nodeShape = { data: PropTypes.object.isRequired, selected: PropTypes.bool }
StepNode.propTypes = nodeShape
ServiceNode.propTypes = nodeShape
MilestoneNode.propTypes = nodeShape
BoneNode.propTypes = nodeShape
MatrixCell.propTypes = nodeShape
GroupNode.propTypes = { data: PropTypes.object.isRequired }

/** A participant in a sequence diagram: a column header. */
export function ActorNode({ data, selected }) {
  return (
    <div
      className={`tm-node shape-pill ${colorClass(data.color)}${selected ? ' is-selected' : ''}`}
      style={{ minWidth: 120, textAlign: 'center' }}
    >
      <EditedMarker data={data} />
      {data.editing ? <NodeEditor data={data} /> : <div className="tm-label">{data.label}</div>}
    </div>
  )
}

/** One message travelling between participants. */
export function MessageNode({ data, selected }) {
  const arrow = data.rightward ? '→' : '←'
  return (
    <div
      className={`tm-node ${colorClass(data.kind === 'return' ? 'slate' : 'blue')}${
        selected ? ' is-selected' : ''
      }`}
      style={{ minWidth: 150 }}
    >
      <Handle type="target" position={Position.Left} />
      <div className="tm-node-head">
        <span className="tm-kind">
          {arrow} {data.kind || 'call'}
        </span>
        <Cite sectionId={data.source_section_id} active={selected} onOpen={data.onOpenSource} />
        <EditedMarker data={data} />
      </div>
      {data.editing ? <NodeEditor data={data} /> : <div className="tm-label">{data.label}</div>}
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

ActorNode.propTypes = nodeShape
MessageNode.propTypes = nodeShape
