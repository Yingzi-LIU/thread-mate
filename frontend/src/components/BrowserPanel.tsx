'use client'

import { MOCK_PAGES } from '@/lib/mockPages'
import type { MockPage } from '@/lib/types'

interface Props {
  width: number
  scale: number
  researchGoal: string
  onPageClick: (page: MockPage) => void
  onImportTabs: () => void
  onDemo: () => void
  visitedPages: Set<string>
  importedPages: MockPage[]
  importStatus: string
}

const CATEGORY_COLORS: Record<string, string> = {
  Theory: '#8b5cf6',
  Explanation: '#06b6d4',
  Spatial: '#10b981',
  Unrelated: '#f43f5e',
  Data: '#10b981',
}

const fs = (size: number, scale: number) => size * scale

export default function BrowserPanel({
  width,
  scale,
  researchGoal,
  onPageClick,
  onImportTabs,
  onDemo,
  visitedPages,
  importedPages,
  importStatus,
}: Props) {
  const pages = importedPages
  const isImportedMode = importedPages.length > 0

  return (
    <aside
      style={{
        width,
        flexShrink: 0,
        height: '100%',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.028), rgba(255,255,255,0.012))',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: `${fs(16, scale)}px ${fs(16, scale)}px ${fs(12, scale)}px`,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: fs(8, scale), marginBottom: fs(4, scale) }}>
          <span style={{ fontSize: fs(15, scale) }}>🌐</span>
          <span
            style={{
              fontSize: fs(12, scale),
              fontWeight: 700,
              color: 'rgba(226,232,240,0.7)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            Page Simulator
          </span>
        </div>
        <p style={{ fontSize: fs(11, scale), color: 'rgba(226,232,240,0.4)', lineHeight: 1.5, marginBottom: fs(10, scale) }}>
          {isImportedMode ? `${importedPages.length} browser tabs ready for analysis` : 'Demo: Allergy Research in Paris'}
        </p>
        <div style={{ display: 'flex', gap: fs(6, scale) }}>
          <button
            onClick={onImportTabs}
            style={{
              flex: 1,
              padding: `${fs(8, scale)}px ${fs(10, scale)}px`,
              borderRadius: 7,
              border: '1px solid rgba(165,180,252,0.24)',
              background: 'rgba(99,102,241,0.12)',
              color: 'rgba(248,250,252,0.88)',
              fontSize: fs(11, scale),
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Import Browser Tabs
          </button>
          <button
            onClick={onDemo}
            style={{
              padding: `${fs(8, scale)}px ${fs(10, scale)}px`,
              borderRadius: 7,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(226,232,240,0.6)',
              fontSize: fs(11, scale),
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Demo
          </button>
        </div>
        {importStatus && (
          <div style={{ marginTop: fs(8, scale), fontSize: fs(10.5, scale), color: 'rgba(226,232,240,0.46)', lineHeight: 1.45 }}>
            {importStatus}
          </div>
        )}
      </div>

      {/* Page list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: `${fs(10, scale)}px ${fs(10, scale)}px` }}>
        {pages.map((page) => {
          const visited = visitedPages.has(page.id)
          const display = getPagePresentation(page, researchGoal)
          const catColor = display.color

          return (
            <button
              key={page.id}
              onClick={() => !visited && onPageClick(page)}
              style={{
                width: '100%',
                marginBottom: fs(8, scale),
                padding: `${fs(10, scale)}px ${fs(12, scale)}px`,
                borderRadius: 8,
                border: visited
                  ? '1px solid rgba(255,255,255,0.04)'
                  : `1px solid rgba(255,255,255,0.07)`,
                background: visited
                  ? 'rgba(255,255,255,0.015)'
                  : 'rgba(255,255,255,0.035)',
                cursor: visited ? 'not-allowed' : 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease',
                position: 'relative',
                opacity: visited ? 0.45 : 1,
              }}
              onMouseEnter={(e) => {
                if (!visited) {
                  ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'
                  ;(e.currentTarget as HTMLElement).style.borderColor = `${catColor}60`
                }
              }}
              onMouseLeave={(e) => {
                if (!visited) {
                  ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.035)'
                  ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'
                }
              }}
            >
              {/* Step badge */}
              {(page.demoStep || isImportedMode) && (
                <div
                  style={{
                    position: 'absolute',
                    top: fs(8, scale),
                    right: fs(8, scale),
                    width: fs(18, scale),
                    height: fs(18, scale),
                    borderRadius: '50%',
                    background: visited ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.08)',
                    border: visited
                      ? '1px solid rgba(16,185,129,0.4)'
                      : '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: fs(9.5, scale),
                    color: visited ? '#10b981' : 'rgba(226,232,240,0.4)',
                    fontWeight: 700,
                    fontFamily: 'monospace',
                  }}
                >
                  {visited ? '✓' : isImportedMode ? (page.demoStep || '•') : page.demoStep}
                </div>
              )}

              {/* Icon + title */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: fs(8, scale), marginBottom: fs(6, scale) }}>
                <span style={{ fontSize: fs(17, scale), lineHeight: 1, flexShrink: 0 }}>{page.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: fs(12, scale),
                      fontWeight: 600,
                      color: visited ? 'rgba(226,232,240,0.4)' : 'rgba(226,232,240,0.9)',
                      lineHeight: 1.4,
                      marginBottom: fs(4, scale),
                      paddingRight: fs(20, scale),
                    }}
                  >
                    {page.title}
                  </div>

                  {/* Category badge */}
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: `${fs(2, scale)}px ${fs(6, scale)}px`,
                      borderRadius: 4,
                      background: visited ? 'rgba(255,255,255,0.04)' : `${catColor}18`,
                      border: `1px solid ${visited ? 'rgba(255,255,255,0.06)' : catColor + '40'}`,
                      fontSize: fs(9.5, scale),
                      fontWeight: 700,
                      color: visited ? 'rgba(226,232,240,0.3)' : catColor,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      marginBottom: fs(4, scale),
                    }}
                  >
                    {display.category}
                  </div>
                </div>
              </div>

              {/* Content preview */}
              <div
                style={{
                  fontSize: fs(11, scale),
                  color: 'rgba(226,232,240,0.45)',
                  lineHeight: 1.5,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {page.content_preview}
              </div>

              {/* URL */}
              <div
                style={{
                  marginTop: fs(6, scale),
                  fontSize: fs(9.5, scale),
                  color: 'rgba(226,232,240,0.26)',
                  fontFamily: 'monospace',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {page.url}
              </div>
            </button>
          )
        })}
      </div>

      {/* Footer hint */}
      <div
        style={{
          padding: `${fs(10, scale)}px ${fs(16, scale)}px`,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          fontSize: fs(10.5, scale),
          color: 'rgba(226,232,240,0.32)',
          lineHeight: 1.5,
          flexShrink: 0,
        }}
      >
        {isImportedMode ? 'Click a page to analyse it, or use Import / Demo to reload' : 'Click "Demo" to load sample pages, or import your own browser tabs'}
      </div>
    </aside>
  )
}

function getPagePresentation(page: MockPage, researchGoal: string) {
  const goal = researchGoal.toLowerCase()
  const isFootballGoal = /\b(football|soccer|psg|marseille|ligue\s*1|paris saint-germain)\b/.test(goal)

  if (page.id === 'news-sports' && isFootballGoal) {
    return { category: 'Football', color: '#10b981' }
  }

  return {
    category: page.category,
    color: CATEGORY_COLORS[page.category] ?? '#6366f1',
  }
}
