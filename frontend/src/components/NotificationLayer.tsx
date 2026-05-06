'use client'

import { useEffect, useState } from 'react'
import type { Notification } from '@/lib/types'

interface Props {
  notification: Notification | null
}

const CONFIG = {
  aligned: {
    accent: '#10b981',
    tint: 'rgba(16,185,129,0.16)',
  },
  expansion: {
    accent: '#f59e0b',
    tint: 'rgba(245,158,11,0.16)',
  },
  drift: {
    accent: '#f43f5e',
    tint: 'rgba(244,63,94,0.14)',
  },
}

export default function NotificationLayer({ notification }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (notification) {
      setVisible(true)
    }
  }, [notification])

  if (!notification || !visible) return null

  const cfg = CONFIG[notification.category] ?? CONFIG.aligned

  return (
    <div
      style={{
        position: 'fixed',
        top: 88,
        right: 28,
        zIndex: 160,
        animation: 'toast-drift-in 0.45s ease-out forwards',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '13px 18px',
          borderRadius: 10,
          background: 'rgba(15,23,42,0.78)',
          border: '1px solid rgba(255,255,255,0.10)',
          backdropFilter: 'blur(20px)',
          boxShadow: `0 16px 38px rgba(0,0,0,0.22), 0 0 28px ${cfg.tint}`,
          maxWidth: 420,
          minWidth: 300,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: cfg.accent,
            boxShadow: `0 0 12px ${cfg.accent}66`,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 13,
            color: 'rgba(226,232,240,0.84)',
            fontWeight: 500,
            lineHeight: 1.5,
          }}
        >
          {notification.message}
        </span>
      </div>
    </div>
  )
}
