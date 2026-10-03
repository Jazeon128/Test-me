import { useLayoutEffect, useRef } from 'react'
import { FileText, Sparkles, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Loader2 } from 'lucide-react'

export default function WorkspacePanel({ side, count, runningCount = 0, collapsed, toggle, children }) {
  const button = useRef(null)
  const previous = useRef(collapsed)
  useLayoutEffect(() => {
    if (previous.current !== collapsed) button.current?.focus()
    previous.current = collapsed
  }, [collapsed])
  const sources = side === 'sources'
  const Icon = sources ? FileText : Sparkles
  const Control = sources ? (collapsed ? PanelLeftOpen : PanelLeftClose) : (collapsed ? PanelRightOpen : PanelRightClose)
  const title = sources ? 'Sources' : 'Studio'
  return <aside data-tour={side} className={`workspace-panel glass-panel ${collapsed ? 'workspace-rail' : ''}`} aria-label={title}>
    <header className="workspace-panel-header">
      {!collapsed && <><Icon aria-hidden="true" size={20} /><h2>{title}</h2><span className="workspace-count">{count}</span>{runningCount > 0 && <span className="workspace-running"><Loader2 size={12} className="animate-spin" aria-hidden="true" />{runningCount} running</span>}</>}
      {toggle && <button ref={button} className="icon-button" aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${side}`}
        aria-expanded={!collapsed} onClick={toggle}><Control aria-hidden="true" size={20} /></button>}
    </header>
    {collapsed ? <Icon aria-hidden="true" size={20} /> : children}
  </aside>
}
