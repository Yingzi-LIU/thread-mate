'use client'

import { useEffect, useCallback } from 'react'
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  Position,
  Handle,
  MarkerType,
  BackgroundVariant,
  type NodeProps,
  type Edge,
  type Node,
} from 'reactflow'
import 'reactflow/dist/style.css'
import type { CognitiveNode, CognitiveEdge } from '@/lib/types'

// ── Node visual config ────────────────────────────────────────────────────
const NODE_CONFIG: Record<string, { color: string; bg: string; border: string; icon: string; label: string }> = {
  goal:        { color: '#6366f1', bg: 'rgba(99,102,241,0.13)',  border: 'rgba(99,102,241,0.55)',  icon: '', label: 'Research Goal' },
  theory:      { color: '#8b5cf6', bg: 'rgba(139,92,246,0.13)',  border: 'rgba(139,92,246,0.55)',  icon: '📚', label: 'THEORY'  },
  explanation: { color: '#06b6d4', bg: 'rgba(6,182,212,0.13)',   border: 'rgba(6,182,212,0.55)',   icon: '🎬', label: 'EXPLAIN' },
  spatial:     { color: '#10b981', bg: 'rgba(16,185,129,0.13)',  border: 'rgba(16,185,129,0.55)',  icon: '🗺️', label: 'SPATIAL' },
  drift:       { color: '#f43f5e', bg: 'rgba(244,63,94,0.13)',   border: 'rgba(244,63,94,0.55)',   icon: '🌊', label: 'DRIFT'   },
  expansion:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.13)',  border: 'rgba(245,158,11,0.55)',  icon: '🌿', label: 'EXPAND'  },
  noise:       { color: '#6b7280', bg: 'rgba(107,114,128,0.13)', border: 'rgba(107,114,128,0.55)', icon: '📄', label: 'NOISE'   },
}

// ── Zone label node (Y-axis bands) ────────────────────────────────────────
function ZoneLabelNode({ data }: NodeProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 10px',
        borderRadius: 6,
        background: `${data.color}0e`,
        border: `1px solid ${data.color}25`,
        pointerEvents: 'none',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: 10.5 }}>{data.icon}</span>
      <span style={{ fontSize: 9.5, fontWeight: 800, color: data.color, letterSpacing: '0.12em' }}>
        {data.label}
      </span>
      <span style={{ fontSize: 9.5, color: `${data.color}70`, fontFamily: 'monospace' }}>
        {data.range}
      </span>
    </div>
  )
}

// ── Cognitive content node ────────────────────────────────────────────────
function CognitiveNodeComponent({ data }: NodeProps) {
  const cfg = NODE_CONFIG[data.semantic_type as string] ?? NODE_CONFIG.theory
  const isGoal = data.semantic_type === 'goal'

  return (
    <div
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderRadius: isGoal ? 16 : 10,
        padding: isGoal ? '14px 18px' : '11px 14px',
        minWidth: isGoal ? 180 : 165,
        maxWidth: 218,
        backdropFilter: 'blur(12px)',
        boxShadow: `0 0 24px ${cfg.color}22, inset 0 1px 0 rgba(255,255,255,0.06)`,
        animation: 'node-appear 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards',
      }}
    >
      {/* GOAL: source handles on all four sides */}
      {isGoal && (
        <>
          <Handle type="source" position={Position.Right}  id="goal-r" style={handleStyle(cfg.color)} />
          <Handle type="source" position={Position.Top}    id="goal-t" style={handleStyle(cfg.color)} />
          <Handle type="source" position={Position.Bottom} id="goal-b" style={handleStyle(cfg.color)} />
          <Handle type="source" position={Position.Left}   id="goal-l" style={handleStyle(cfg.color)} />
        </>
      )}

      {/* Regular nodes: target on left, source on right */}
      {!isGoal && (
        <Handle type="target" position={Position.Left}  style={handleStyle(cfg.color)} />
      )}

      {/* Type badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
        {cfg.icon && <span style={{ fontSize: isGoal ? 16 : 13.5 }}>{cfg.icon}</span>}
        <span style={{
          fontSize: 9.5, fontWeight: 800, color: cfg.color,
          letterSpacing: isGoal ? '0.04em' : '0.12em',
          fontFamily: isGoal ? 'inherit' : 'monospace',
          textTransform: isGoal ? 'none' : 'uppercase',
        }}>
          {cfg.label}
        </span>
      </div>

      {/* Title */}
      <div style={{
        fontSize: isGoal ? 12.5 : 11.5, fontWeight: isGoal ? 700 : 600,
        color: '#e2e8f0', lineHeight: 1.4, marginBottom: 4,
      }}>
        {data.title}
      </div>

      {/* Description */}
      {data.description && !isGoal && (
        <div style={{ fontSize: 9.5, color: 'rgba(226,232,240,0.48)', lineHeight: 1.45, marginBottom: 5 }}>
          {data.description}
        </div>
      )}

      {/* Relevance bar */}
      {!isGoal && typeof data.relevance_score === 'number' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
          <div style={{ flex: 1, height: 2, borderRadius: 1, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{
              width: `${Math.round(data.relevance_score * 100)}%`,
              height: '100%', background: cfg.color, borderRadius: 1,
              boxShadow: `0 0 4px ${cfg.color}`,
            }} />
          </div>
          <span style={{ fontSize: 8.5, color: cfg.color, fontFamily: 'monospace', fontWeight: 700, minWidth: 24 }}>
            {Math.round(data.relevance_score * 100)}%
          </span>
        </div>
      )}

      {/* Topic tags */}
      {!isGoal && Array.isArray(data.topics) && data.topics.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 5 }}>
          {data.topics.slice(0, 3).map((t: string) => (
            <span key={t} style={{
              padding: '1px 5px', borderRadius: 3,
              background: `${cfg.color}18`, border: `1px solid ${cfg.color}30`,
              fontSize: 8.5, color: `${cfg.color}cc`, fontFamily: 'monospace',
            }}>
              {t}
            </span>
          ))}
        </div>
      )}

      {!isGoal && (
        <Handle type="source" position={Position.Right} style={handleStyle(cfg.color)} />
      )}
    </div>
  )
}

function handleStyle(color: string) {
  return { background: color, border: 'none', width: 7, height: 7, boxShadow: `0 0 6px ${color}` }
}

const NODE_TYPES = {
  cognitiveNode: CognitiveNodeComponent,
  zoneLabel: ZoneLabelNode,
}

// ── Zone label nodes (static, always present) ─────────────────────────────
// Positioned just left of where page nodes start (x=-130 in graph space)
const ZONE_LABEL_NODES: Node[] = [
  {
    id: 'zlabel-aligned',
    type: 'zoneLabel',
    position: { x: -145, y: 62 },
    data: { label: 'ALIGNED', icon: '🟢', color: '#10b981', range: '≥65%' },
    selectable: false,
    draggable: false,
  },
  {
    id: 'zlabel-expansion',
    type: 'zoneLabel',
    position: { x: -145, y: 262 },
    data: { label: 'EXPANSION', icon: '🟡', color: '#f59e0b', range: '35-65%' },
    selectable: false,
    draggable: false,
  },
  {
    id: 'zlabel-drift',
    type: 'zoneLabel',
    position: { x: -145, y: 462 },
    data: { label: 'DRIFT', icon: '🔴', color: '#f43f5e', range: '<35%' },
    selectable: false,
    draggable: false,
  },
]

// ── Convert backend node → React Flow node ────────────────────────────────
function toRFNode(n: CognitiveNode): Node {
  return {
    id: n.id,
    type: 'cognitiveNode',
    position: { x: n.x, y: n.y },
    data: n,
    draggable: true,
  }
}

// ── Convert backend edge → React Flow edge ────────────────────────────────
const EDGE_COLORS: Record<string, string> = {
  goal: '#6366f1', theory: '#8b5cf6', explanation: '#06b6d4',
  spatial: '#10b981', drift: '#f43f5e', expansion: '#f59e0b',
}

function toRFEdge(e: CognitiveEdge, nodes: CognitiveNode[]): Edge {
  const target = nodes.find((n) => n.id === e.target)
  const source = nodes.find((n) => n.id === e.source)
  const color = target ? (EDGE_COLORS[target.semantic_type] ?? '#6366f1') : '#6366f1'

  // For GOAL → node edges, pick the directional handle
  let sourceHandle: string | undefined
  if (e.source === 'goal' && source && target) {
    const dy = target.y - source.y
    const dx = target.x - source.x
    // Primarily route by Y direction; fallback to right
    if (dy < -60) sourceHandle = 'goal-t'       // target is above (aligned)
    else if (dy > 60) sourceHandle = 'goal-b'   // target is below (drift)
    else sourceHandle = 'goal-r'                // same row (expansion)
  }

  return {
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle,
    animated: e.animated,
    style: {
      stroke: color,
      strokeWidth: Math.max(1, e.strength * 2.5),
      opacity: e.animated ? 0.7 : 0.35,
      strokeDasharray: e.animated ? undefined : '6 3',
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color,
      width: 12,
      height: 12,
    },
  }
}

// ── Main graph component ──────────────────────────────────────────────────
interface Props {
  nodes: CognitiveNode[]
  edges: CognitiveEdge[]
  onNodeClick?: (node: CognitiveNode) => void
}

export default function CognitiveGraph({ nodes, edges, onNodeClick }: Props) {
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(ZONE_LABEL_NODES)
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState([])

  useEffect(() => {
    if (nodes.length === 0) {
      setRfNodes([])
      setRfEdges([])
      return
    }
    setRfNodes([...ZONE_LABEL_NODES, ...nodes.map(toRFNode)])
    setRfEdges(edges.map((e) => toRFEdge(e, nodes)))
  }, [nodes, edges])

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, rfNode: Node) => {
      if (!onNodeClick) return
      const cogNode = nodes.find((n) => n.id === rfNode.id)
      if (cogNode && cogNode.id !== 'goal') onNodeClick(cogNode)
    },
    [nodes, onNodeClick]
  )

  return (
    <div style={{ flex: 1, height: '100%', position: 'relative' }}>
      {/* Field backdrop */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: `
          linear-gradient(180deg, rgba(99,102,241,0.035), transparent 34%),
          linear-gradient(90deg, rgba(16,185,129,0.025), transparent 28%, transparent 72%, rgba(244,63,94,0.025))
        `,
      }} />

      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.25, includeHiddenNodes: false }}
        minZoom={0.2}
        maxZoom={2}
        style={{ background: 'transparent' }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="rgba(255,255,255,0.04)" />
        <Controls style={{ bottom: 20, left: 20 }} showInteractive={false} />
      </ReactFlow>

      {/* Graph title */}
      <div style={{
        position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)',
        zIndex: 10, pointerEvents: 'none', textAlign: 'center',
      }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(226,232,240,0.18)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          Cognitive Graph — time →
        </div>
      </div>

      {/* Axis labels */}
      <div style={{
        position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%) rotate(90deg)',
        zIndex: 10, pointerEvents: 'none',
        fontSize: 9, fontWeight: 700, color: 'rgba(226,232,240,0.14)',
        letterSpacing: '0.15em', textTransform: 'uppercase', whiteSpace: 'nowrap',
      }}>
        ← relevance →
      </div>
    </div>
  )
}
