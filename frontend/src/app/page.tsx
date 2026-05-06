'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import dynamic from 'next/dynamic'
import BrowserPanel from '@/components/BrowserPanel'
import ReflectionPanel from '@/components/ReflectionPanel'
import NotificationLayer from '@/components/NotificationLayer'
import { MOCK_PAGES } from '@/lib/mockPages'
import type {
  GraphData,
  Reflection,
  Notification,
  MockPage,
  WSMessage,
  CategoryCounts,
  CognitiveNode,
  TabImport,
  ExtensionSessionImport,
} from '@/lib/types'

// SSR-safe: React Flow uses browser APIs
const CognitiveGraph = dynamic(() => import('@/components/CognitiveGraph'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'rgba(226,232,240,0.2)',
        fontSize: 12,
      }}
    >
      Loading graph…
    </div>
  ),
})

const WS_URL = 'ws://127.0.0.1:8000/ws'
const API_URL = 'http://127.0.0.1:8000'
const RECONNECT_DELAY = 3000

export default function Home() {
  const [connected, setConnected] = useState(false)
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] })
  const [reflection, setReflection] = useState<Reflection | null>(null)
  const [notification, setNotification] = useState<Notification | null>(null)
  const [driftScore, setDriftScore] = useState(0)
  const [sessionAlignment, setSessionAlignment] = useState(0)
  const [categoryCounts, setCategoryCounts] = useState<CategoryCounts>({ aligned: 0, expansion: 0, drift: 0 })
  const [visitedPages, setVisitedPages] = useState<Set<string>>(new Set())
  const [importedPages, setImportedPages] = useState<MockPage[]>([])
  const [importStatus, setImportStatus] = useState('')
  const [nodeCount, setNodeCount] = useState(0)
  const [selectedNode, setSelectedNode] = useState<CognitiveNode | null>(null)
  const [browserWidth, setBrowserWidth] = useState(360)
  const [reflectionWidth, setReflectionWidth] = useState(380)
  const [researchGoal, setResearchGoal] = useState('Allergy research in Paris')

  const wsRef = useRef<WebSocket | null>(null)
  const notifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── WebSocket connection ─────────────────────────────────────────────
  const connectWS = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(WS_URL)

    ws.onopen = () => {
      setConnected(true)
      console.log('[CFA] WebSocket connected')
    }

    ws.onclose = () => {
      setConnected(false)
      console.log('[CFA] WebSocket disconnected — reconnecting...')
      setTimeout(connectWS, RECONNECT_DELAY)
    }

    ws.onerror = () => {
      setConnected(false)
    }

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data)
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }))
          return
        }
        handleMessage(msg)
      } catch (err) {
        console.error('[CFA] Parse error', err)
      }
    }

    wsRef.current = ws
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    connectWS()
    return () => {
      wsRef.current?.close()
    }
  }, [connectWS])

  // ── Message handler ──────────────────────────────────────────────────
  const handleMessage = (msg: WSMessage) => {
    if (msg.graph) {
      setGraphData(msg.graph)
      setNodeCount(msg.graph.nodes.length)
    }
    if (msg.reflection) {
      setReflection(msg.reflection)
      setResearchGoal(msg.reflection.goal)
    }
    if (msg.notification) {
      // Clear any existing notification timer
      if (notifTimerRef.current) clearTimeout(notifTimerRef.current)
      setNotification(msg.notification)
      notifTimerRef.current = setTimeout(() => setNotification(null), 8000)
    }
    if (msg.drift_score !== undefined) setDriftScore(msg.drift_score)
    if (msg.session_alignment !== undefined) setSessionAlignment(msg.session_alignment)
    if (msg.category_counts) setCategoryCounts(msg.category_counts)

    if (msg.type === 'batch_update') {
      setImportStatus(`Imported and analysed ${msg.graph?.nodes?.length ? msg.graph.nodes.length - 1 : 0} tab(s).`)
    }

    if (msg.type === 'reset' || msg.type === 'goal_update') {
      setVisitedPages(new Set())
      setDriftScore(0)
      setSessionAlignment(0)
      setCategoryCounts({ aligned: 0, expansion: 0, drift: 0 })
      setSelectedNode(null)
    }
  }

  const sendPageVisit = useCallback((page: MockPage) => {
    wsRef.current?.send(
      JSON.stringify({
        type: 'page_visit',
        page: {
          id: page.id,
          title: page.title,
          type: page.type,
          content_preview: page.content_preview,
          url: page.url,
        },
      })
    )
  }, [])

  // ── Page click handler ───────────────────────────────────────────────
  const handlePageClick = useCallback(
    (page: MockPage) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
      if (visitedPages.has(page.id)) return

      setVisitedPages((prev) => {
        const next = new Set(Array.from(prev))
        next.add(page.id)
        return next
      })

      sendPageVisit(page)
    },
    [sendPageVisit, visitedPages]
  )

  const applyResearchGoal = useCallback((value: string) => {
    const goal = normalizeGoalTitle(value)
    setResearchGoal(goal)
    setSelectedNode(null)
    setVisitedPages(new Set())
    setImportedPages([])
    setImportStatus('')

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'set_goal', goal }))
    } else {
      setReflection((prev) => prev ? { ...prev, goal } : prev)
    }
  }, [])

  const handleImportTabs = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setImportStatus('Connect the app backend first, then import tabs.')
      return
    }

    setImportStatus('Looking for tabs sent from the Chrome extension…')

    try {
      // Auto-import goal from extension session
      try {
        const sessionResp = await fetch(`${API_URL}/imports/session`)
        if (sessionResp.ok) {
          const sessionPayload = (await sessionResp.json()) as ExtensionSessionImport
          if (sessionPayload.goal) {
            applyResearchGoal(sessionPayload.goal)
          }
        }
      } catch {
        // Goal import is best-effort; continue regardless
      }

      const response = await fetch(`${API_URL}/imports/latest`)
      if (!response.ok) throw new Error('Import request failed')

      const payload = (await response.json()) as TabImport
      if (!payload.tabs?.length) {
        setImportStatus('No new browser tabs found yet. Start a Threadmate session, open new tabs, then click “Send New Tabs to App”.')
        return
      }

      const pages = payload.tabs.map((tab, index) => ({
        id: tab.id || `browser-tab-${index + 1}`,
        title: tab.title || 'Untitled tab',
        type: tab.type || 'web',
        content_preview: tab.content_preview || tab.url,
        url: tab.url,
        icon: getImportedPageIcon(tab.type, tab.active),
        category: tab.active ? 'Current Tab' : 'Browser Tab',
        color: tab.active ? '#10b981' : '#6366f1',
        demoStep: index + 1,
      }))

      setImportedPages(pages)

      const nextVisited = new Set(visitedPages)
      const freshPages = pages.filter((page) => !nextVisited.has(page.id))
      freshPages.forEach((page) => nextVisited.add(page.id))
      setVisitedPages(nextVisited)

      if (freshPages.length === 0) {
        setImportStatus('No new tabs to import.')
        return
      }

      setImportStatus(`Analysing ${freshPages.length} tab${freshPages.length === 1 ? '' : 's'}…`)
      wsRef.current.send(JSON.stringify({
        type: 'batch_visit',
        pages: freshPages.map((page) => ({
          id: page.id,
          title: page.title,
          type: page.type,
          content_preview: page.content_preview,
          url: page.url,
        })),
      }))
    } catch (error) {
      console.error('[Threadmate] Import failed', error)
      setImportStatus(`Import failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }, [sendPageVisit, visitedPages, applyResearchGoal])

  // ── Demo handler ─────────────────────────────────────────────────────
  const handleDemo = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setImportStatus('Connect the app backend first.')
      return
    }
    setImportedPages(MOCK_PAGES)
    setVisitedPages(new Set())
    setImportStatus(`Analysing ${MOCK_PAGES.length} demo tabs…`)
    wsRef.current.send(JSON.stringify({
      type: 'batch_visit',
      pages: MOCK_PAGES.map((p) => ({
        id: p.id,
        title: p.title,
        type: p.type,
        content_preview: p.content_preview,
        url: p.url,
      })),
    }))
  }, [])

  // ── Reset handler ────────────────────────────────────────────────────
  const handleReset = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'reset', goal: researchGoal }))
    }
    setImportedPages([])
    setImportStatus('')
  }

  const startResize = useCallback(
    (side: 'browser' | 'reflection') => (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault()

      const startX = event.clientX
      const startWidth = side === 'browser' ? browserWidth : reflectionWidth

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const delta = moveEvent.clientX - startX
        const nextWidth = side === 'browser' ? startWidth + delta : startWidth - delta
        const clamped = Math.min(500, Math.max(280, nextWidth))

        if (side === 'browser') setBrowserWidth(clamped)
        else setReflectionWidth(clamped)
      }

      const handlePointerUp = () => {
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('pointerup', handlePointerUp)
      }

      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerUp)
    },
    [browserWidth, reflectionWidth]
  )

  // ── UI ───────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        height: '100vh',
        background: '#0a0618',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* ── Header ── */}
      <header
        style={{
          height: 68,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.018))',
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          gap: 16,
          flexShrink: 0,
        }}
      >
        {/* Logo + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 8,
              height: 34,
              borderRadius: 999,
              background: 'linear-gradient(180deg, #a5b4fc, #10b981)',
              boxShadow: '0 0 18px rgba(99,102,241,0.35)',
            }}
          />
          <div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: '#e2e8f0',
                letterSpacing: '0.02em',
              }}
            >
              Threadmate
            </div>
            <div style={{ fontSize: 11, color: 'rgba(226,232,240,0.42)', letterSpacing: '0.12em', marginTop: 2 }}>
              RESEARCH THREAD COMPANION
            </div>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {/* Node counter */}
        {nodeCount > 1 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 20,
              background: 'rgba(99,102,241,0.1)',
              border: '1px solid rgba(99,102,241,0.25)',
            }}
          >
            <span style={{ fontSize: 12 }}>🗂️</span>
            <span style={{ fontSize: 12, color: '#a5b4fc', fontWeight: 700 }}>
              {nodeCount - 1} node{nodeCount - 1 !== 1 ? 's' : ''} mapped
            </span>
          </div>
        )}

        {/* Connection status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: connected ? '#10b981' : '#f43f5e',
              boxShadow: connected ? '0 0 8px #10b981' : '0 0 8px #f43f5e',
              transition: 'all 0.3s ease',
            }}
          />
          <span style={{ fontSize: 12, color: 'rgba(226,232,240,0.52)', fontWeight: 600 }}>
            {connected ? 'Connected' : 'Connecting…'}
          </span>
        </div>

        {/* Reset button */}
        <button
          onClick={handleReset}
          style={{
            padding: '7px 14px',
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.04)',
            color: 'rgba(226,232,240,0.5)',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            ;(e.target as HTMLElement).style.background = 'rgba(255,255,255,0.08)'
            ;(e.target as HTMLElement).style.color = 'rgba(226,232,240,0.8)'
          }}
          onMouseLeave={(e) => {
            ;(e.target as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
            ;(e.target as HTMLElement).style.color = 'rgba(226,232,240,0.5)'
          }}
        >
          ↺ Reset
        </button>
      </header>

      {/* ── Main layout ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <BrowserPanel
          width={browserWidth}
          scale={getPanelScale(browserWidth)}
          researchGoal={researchGoal}
          onPageClick={handlePageClick}
          onImportTabs={handleImportTabs}
          onDemo={handleDemo}
          visitedPages={visitedPages}
          importedPages={importedPages}
          importStatus={importStatus}
        />

        <ResizeHandle side="left" onPointerDown={startResize('browser')} />

        {/* Center: Cognitive Graph */}
        <main style={{
          flex: '1 1 420px',
          minWidth: 300,
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
          borderInline: '1px solid rgba(255,255,255,0.03)',
        }}>
          <CognitiveGraph
            nodes={graphData.nodes}
            edges={graphData.edges}
            onNodeClick={setSelectedNode}
          />
        </main>

        <ResizeHandle side="right" onPointerDown={startResize('reflection')} />

        <ReflectionPanel
          width={reflectionWidth}
          scale={getPanelScale(reflectionWidth)}
          goal={researchGoal}
          reflection={reflection}
          selectedNode={selectedNode}
          driftScore={driftScore}
          sessionAlignment={sessionAlignment}
          categoryCounts={categoryCounts}
        />
      </div>

      {/* ── Toast notifications ── */}
      <NotificationLayer notification={notification} />

      {/* ── Backend offline banner ── */}
      {!connected && (
        <div
          style={{
            position: 'fixed',
            top: 78,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 200,
            padding: '10px 20px',
            borderRadius: 10,
            background: 'rgba(244,63,94,0.12)',
            border: '1px solid rgba(244,63,94,0.3)',
            backdropFilter: 'blur(16px)',
            fontSize: 11,
            color: 'rgba(226,232,240,0.7)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>⚠️</span>
          Backend offline — start the FastAPI server on port 8000
        </div>
      )}
    </div>
  )
}

function getImportedPageIcon(type: string, active?: boolean) {
  if (active) return '●'
  if (type === 'video') return '▶'
  if (type === 'map') return '⌖'
  if (type === 'news') return '◆'
  return '◦'
}

function getPanelScale(width: number) {
  return Math.min(1.22, Math.max(1.04, width / 310))
}

function normalizeGoalTitle(value: string) {
  const clean = value.trim().replace(/\s+/g, ' ') || 'Allergy research in Paris'
  const smallWords = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'vs', 'with'])
  const words = clean.split(' ')

  return words.map((word, index) => {
    if (word === word.toUpperCase() && word.length <= 4) return word

    const lower = word.toLowerCase()
    if (index > 0 && index < words.length - 1 && smallWords.has(lower)) return lower

    return lower.charAt(0).toUpperCase() + lower.slice(1)
  }).join(' ')
}

function ResizeHandle({
  side,
  onPointerDown,
}: {
  side: 'left' | 'right'
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
}) {
  return (
    <div
      onPointerDown={onPointerDown}
      title="Drag to resize"
      style={{
        width: 10,
        height: '100%',
        flexShrink: 0,
        cursor: 'col-resize',
        position: 'relative',
        zIndex: 20,
        background:
          side === 'left'
            ? 'linear-gradient(90deg, rgba(255,255,255,0.025), transparent)'
            : 'linear-gradient(90deg, transparent, rgba(255,255,255,0.025))',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.08)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLElement).style.background =
          side === 'left'
            ? 'linear-gradient(90deg, rgba(255,255,255,0.025), transparent)'
            : 'linear-gradient(90deg, transparent, rgba(255,255,255,0.025))'
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 2,
          height: 42,
          transform: 'translate(-50%, -50%)',
          borderRadius: 999,
          background: 'rgba(226,232,240,0.18)',
          boxShadow: '0 0 12px rgba(99,102,241,0.24)',
        }}
      />
    </div>
  )
}
