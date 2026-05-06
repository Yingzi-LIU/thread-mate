'use client'

import type { Reflection, CategoryCounts, CognitiveNode } from '@/lib/types'

interface Props {
  width: number
  scale: number
  goal: string
  reflection: Reflection | null
  selectedNode: CognitiveNode | null
  driftScore: number
  sessionAlignment: number
  categoryCounts: CategoryCounts
}

const CATEGORY_CONFIG = {
  aligned:   { color: '#10b981', bg: 'rgba(16,185,129,0.10)',  border: 'rgba(16,185,129,0.25)',  label: 'ALIGNED',   icon: '🟢' },
  expansion: { color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.25)',  label: 'EXPANDING', icon: '🟡' },
  drift:     { color: '#f43f5e', bg: 'rgba(244,63,94,0.10)',  border: 'rgba(244,63,94,0.25)',   label: 'DRIFT',     icon: '🔴' },
}

const fs = (size: number, scale: number) => size * scale

export default function ReflectionPanel({
  width,
  scale,
  goal,
  reflection,
  selectedNode,
  driftScore,
  sessionAlignment,
  categoryCounts,
}: Props) {
  // Determine what to show in CURRENT PAGE section
  // Priority: clicked graph node > last-visited reflection
  const showNode = selectedNode !== null

  const activeCat = showNode
    ? (CATEGORY_CONFIG[selectedNode!.alignment_category] ?? CATEGORY_CONFIG.aligned)
    : reflection
    ? (CATEGORY_CONFIG[reflection.alignment_category] ?? CATEGORY_CONFIG.aligned)
    : null

  const activePct = showNode
    ? Math.round(selectedNode!.relevance_score * 100)
    : reflection
    ? Math.round(reflection.alignment_score * 100)
    : 0

  const activeTopics = showNode
    ? selectedNode!.topics
    : reflection?.current_topics ?? []

  const activeMessage = showNode
    ? selectedNode!.description
    : reflection?.soft_message ?? ''

  const activeSuggestion = showNode ? null : reflection?.suggestion

  const sessionPct   = Math.round(sessionAlignment * 100)
  const driftPct     = Math.round(driftScore * 100)
  const totalVisited = categoryCounts.aligned + categoryCounts.expansion + categoryCounts.drift

  return (
    <aside style={{
      width, flexShrink: 0, height: '100%',
      borderLeft: '1px solid rgba(255,255,255,0.06)',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.028), rgba(255,255,255,0.012))',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: `${fs(16, scale)}px ${fs(16, scale)}px ${fs(12, scale)}px`, borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: fs(8, scale), marginBottom: fs(4, scale) }}>
          <span style={{ fontSize: fs(15, scale) }}>🔮</span>
          <span style={{ fontSize: fs(12, scale), fontWeight: 700, color: 'rgba(226,232,240,0.7)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Thread Reflection
          </span>
        </div>
        <p style={{ fontSize: fs(11, scale), color: 'rgba(226,232,240,0.4)' }}>Real-time attention mirror</p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: `${fs(12, scale)}px`, display: 'flex', flexDirection: 'column', gap: fs(12, scale) }}>

        <PanelCard scale={scale}>
          <PanelTitle label="Research Goal" scale={scale} accent="#a5b4fc" />
          <div style={{
            marginTop: fs(10, scale),
            padding: `${fs(8, scale)}px ${fs(10, scale)}px`,
            borderRadius: 8,
            border: '1px solid rgba(165,180,252,0.2)',
            background: 'rgba(99,102,241,0.08)',
            fontSize: fs(12, scale),
            fontWeight: 600,
            color: goal ? '#f8fafc' : 'rgba(226,232,240,0.35)',
            lineHeight: 1.45,
            fontStyle: goal ? 'normal' : 'italic',
          }}>
            {goal || 'Import browser tabs to set goal'}
          </div>
        </PanelCard>

        <PanelCard scale={scale}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: fs(8, scale), marginBottom: fs(10, scale) }}>
            <PanelTitle label="Current Page" scale={scale} />
            {showNode && (
              <span style={{
                fontSize: fs(9, scale), padding: `${fs(2, scale)}px ${fs(7, scale)}px`, borderRadius: 999,
                background: 'rgba(99,102,241,0.16)', border: '1px solid rgba(99,102,241,0.35)',
                color: '#c7d2fe', fontFamily: 'monospace', whiteSpace: 'nowrap',
              }}>
                graph node
              </span>
            )}
          </div>

          {activeCat ? (
            <>
              {showNode && (
                <FeatureCard scale={scale}>
                  <SectionLabel label="Selected Page" scale={scale} />
                  <div style={{ fontSize: fs(12.5, scale), fontWeight: 650, color: '#f8fafc', lineHeight: 1.4 }}>
                  {selectedNode!.title}
                  </div>
                </FeatureCard>
              )}

              {/* Status badge */}
              <FeatureCard scale={scale} borderColor={activeCat.border} background={activeCat.bg}>
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: fs(9, scale),
                }}>
                  <span style={{ fontSize: fs(14, scale), marginTop: fs(1, scale) }}>{activeCat.icon}</span>
                  <div style={{ flex: 1 }}>
                    <SectionLabel label={activeCat.label} scale={scale} color={activeCat.color} />
                    <div style={{ fontSize: fs(11.5, scale), color: 'rgba(226,232,240,0.68)', lineHeight: 1.55 }}>
                      {activeMessage}
                    </div>
                  </div>
                </div>
              </FeatureCard>

              {/* Page alignment score */}
              <Section label={`Page Alignment — ${activePct}%`} scale={scale}>
                <ScoreBar value={activePct} color={activePct >= 65 ? '#10b981' : activePct >= 35 ? '#f59e0b' : '#f43f5e'} />
                <div style={{ fontSize: fs(10, scale), color: 'rgba(226,232,240,0.32)', marginTop: fs(4, scale) }}>
                  Relevance of this page to your research goal
                </div>
              </Section>

              {/* Topics */}
              {activeTopics.length > 0 && (
                <Section label="Detected Topics" scale={scale}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: fs(4, scale) }}>
                    {activeTopics.map(t => (
                      <span key={t} style={{
                        padding: `${fs(2, scale)}px ${fs(7, scale)}px`, borderRadius: 4, fontSize: fs(9.5, scale),
                        background: `${activeCat.color}15`, border: `1px solid ${activeCat.color}35`,
                        color: `${activeCat.color}cc`, fontFamily: 'monospace',
                      }}>{t}</span>
                    ))}
                  </div>
                </Section>
              )}

              {/* Suggestion (last-visited mode only) */}
              {activeSuggestion && (
                <Section label="Suggestion" scale={scale}>
                  <div style={{
                    padding: `${fs(7, scale)}px ${fs(10, scale)}px`, borderRadius: 8,
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                    fontSize: fs(11.5, scale), color: 'rgba(226,232,240,0.62)', lineHeight: 1.6,
                  }}>
                    💡 {activeSuggestion}
                  </div>
                </Section>
              )}
            </>
          ) : (
            <FeatureCard scale={scale}>
              <div style={{ fontSize: fs(12, scale), color: 'rgba(226,232,240,0.45)', fontStyle: 'italic', lineHeight: 1.5 }}>
              Click a page or graph node to begin analysis…
              </div>
            </FeatureCard>
          )}
        </PanelCard>

        {/* ══════════════ SECTION B: Session Summary ══════════════ */}
        <PanelCard scale={scale}>
          <PanelTitle label="Session Summary" scale={scale} />
          <div style={{ height: fs(10, scale) }} />

          {/* Session alignment */}
          <Section label={`Session Alignment — ${sessionPct}%`} scale={scale}>
            <ScoreBar value={sessionPct} color={sessionPct >= 65 ? '#10b981' : sessionPct >= 35 ? '#f59e0b' : '#f43f5e'} />
            <div style={{ fontSize: fs(10, scale), color: 'rgba(226,232,240,0.32)', marginTop: fs(4, scale) }}>
              Average across all {totalVisited} visited page{totalVisited !== 1 ? 's' : ''}
            </div>
          </Section>

          {/* Drift score */}
          <Section label={`Cognitive Drift — ${driftPct}%`} scale={scale}>
            <ScoreBar value={driftPct} color={driftPct > 40 ? '#f43f5e' : driftPct > 20 ? '#f59e0b' : '#6366f1'} />
            <div style={{ fontSize: fs(10, scale), color: 'rgba(226,232,240,0.32)', marginTop: fs(4, scale) }}>
              Average distance from research goal
            </div>
          </Section>

          {/* Category breakdown */}
          {totalVisited > 0 && (
            <Section label="Page Breakdown" scale={scale}>
              <div style={{ display: 'flex', gap: fs(6, scale) }}>
                {([
                  { key: 'aligned',   label: 'Aligned', color: '#10b981', icon: '🟢' },
                  { key: 'expansion', label: 'Expand',  color: '#f59e0b', icon: '🟡' },
                  { key: 'drift',     label: 'Drift',   color: '#f43f5e', icon: '🔴' },
                ] as const).map(({ key, label, color, icon }) => (
                  <div key={key} style={{
                    flex: 1, padding: `${fs(6, scale)}px ${fs(4, scale)}px`, borderRadius: 7, textAlign: 'center',
                    background: `${color}10`, border: `1px solid ${color}25`,
                  }}>
                    <div style={{ fontSize: fs(14.5, scale), marginBottom: fs(2, scale) }}>{icon}</div>
                    <div style={{ fontSize: fs(17, scale), fontWeight: 700, color, fontFamily: 'monospace' }}>
                      {categoryCounts[key]}
                    </div>
                    <div style={{ fontSize: fs(9, scale), color: `${color}80`, marginTop: fs(2, scale) }}>{label}</div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Cognitive summary */}
          {reflection && (
            <Section label="Cognitive Summary" scale={scale}>
              <div style={{
                fontSize: fs(12, scale), color: 'rgba(226,232,240,0.72)',
                lineHeight: 1.7, fontStyle: 'italic',
              }}>
                "{reflection.cognitive_summary}"
              </div>
            </Section>
          )}
        </PanelCard>

      </div>

      {/* Footer */}
      <div style={{
        padding: `${fs(10, scale)}px ${fs(14, scale)}px`, borderTop: '1px solid rgba(255,255,255,0.06)',
        fontSize: fs(10, scale), color: 'rgba(226,232,240,0.24)', lineHeight: 1.6, flexShrink: 0,
      }}>
        Threadmate — observing, not judging
      </div>
    </aside>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, marginBottom: 10,
    }}>
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
      <span style={{
        fontSize: 8, fontWeight: 800, color: 'rgba(226,232,240,0.25)',
        letterSpacing: '0.14em', textTransform: 'uppercase', whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
    </div>
  )
}

function Section({ label, scale, children }: { label: string; scale: number; children: React.ReactNode }) {
  return (
    <FeatureCard scale={scale}>
      <SectionLabel label={label} scale={scale} />
      {children}
    </FeatureCard>
  )
}

function PanelCard({ scale, children }: { scale: number; children: React.ReactNode }) {
  return (
    <section style={{
      padding: `${fs(14, scale)}px`,
      borderRadius: 8,
      background: 'rgba(15,23,42,0.46)',
      border: '1px solid rgba(255,255,255,0.095)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
    }}>
      {children}
    </section>
  )
}

function FeatureCard({
  scale,
  borderColor = 'rgba(255,255,255,0.09)',
  background = 'rgba(255,255,255,0.035)',
  children,
}: {
  scale: number
  borderColor?: string
  background?: string
  children: React.ReactNode
}) {
  return (
    <div style={{
      padding: `${fs(10, scale)}px ${fs(11, scale)}px`,
      borderRadius: 8,
      background,
      border: `1px solid ${borderColor}`,
      marginBottom: fs(10, scale),
    }}>
      {children}
    </div>
  )
}

function PanelTitle({ label, scale, accent = '#f8fafc' }: { label: string; scale: number; accent?: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: fs(8, scale),
      color: '#f8fafc',
      fontSize: fs(13, scale),
      fontWeight: 900,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
    }}>
      <span style={{
        width: 4,
        height: fs(17, scale),
        borderRadius: 999,
        background: accent,
        boxShadow: `0 0 12px ${accent}55`,
      }} />
      {label}
    </div>
  )
}

function SectionLabel({ label, scale, color = 'rgba(248,250,252,0.9)' }: { label: string; scale: number; color?: string }) {
  return (
    <div style={{
      fontSize: fs(10.5, scale),
      fontWeight: 850,
      color,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      marginBottom: fs(7, scale),
    }}>
      {label}
    </div>
  )
}

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${value}%`, background: color, borderRadius: 3,
        transition: 'width 0.6s ease, background 0.4s ease',
        boxShadow: `0 0 8px ${color}50`,
      }} />
    </div>
  )
}
