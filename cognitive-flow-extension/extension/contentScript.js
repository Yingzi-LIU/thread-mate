chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'CFA_EXTRACT_PAGE') {
    sendResponse(extractPage())
    return true
  }

  if (message.type === 'CFA_SHOW_PROMPT') {
    showPrompt(message)
    sendResponse({ ok: true })
    return true
  }

  return false
})

function extractPage() {
  const title = document.title || ''
  const metaDescription = document.querySelector('meta[name="description"]')?.content || ''
  const headings = Array.from(document.querySelectorAll('h1,h2')).slice(0, 6).map((el) => el.textContent || '')
  const paragraphs = Array.from(document.querySelectorAll('p')).slice(0, 8).map((el) => el.textContent || '')
  const text = [metaDescription, ...headings, ...paragraphs].join('\n').replace(/\s+/g, ' ').slice(0, 2400)
  return { title, text }
}

const TONE_COPY = {
  strict: {
    title: 'You are off the current task.',
    copy: 'This tab has been drifting for a bit. Decide now: justify it, park it, or return to the work.',
    relevant: 'Mark as relevant',
    stay: 'Stay on this page',
    later: 'Remind me later',
    goal: 'OK, let’s go back to the trail',
    end: 'I want to end this session',
    verified: 'Accepted. This page is now part of the working thread.',
    tentative: 'I see your vote, but the page evidence is still thin. I will not learn from it yet.',
    stayAck: 'Detour acknowledged. I will not interrupt this tab again.',
    laterAck: 'Understood. I will check again later.',
    backAck: 'Returning to the last on-goal tab.',
    noBackAck: 'No aligned tab found yet. Choose a goal-related page first.',
    endAck: 'Session ended.',
  },
  friend: {
    title: 'Tiny detour check-in.',
    copy: 'This page feels a little off the main trail. No drama. Want to keep wandering, or hop back to the thread?',
    relevant: 'This is useful',
    stay: 'Stay on this page',
    later: 'Remind me later',
    goal: 'OK, let’s go back to the trail',
    end: 'I want to end this session',
    verified: 'Got it. I’ll treat this as part of the thread from now on.',
    tentative: 'I’ll trust your instinct for this tab, but I won’t train on it just yet.',
    stayAck: 'Cool. Side trail approved. I’ll stop poking this tab.',
    laterAck: 'Deal. I’ll circle back later, very politely.',
    backAck: 'Back to the trail. Smooth little course correction.',
    noBackAck: 'Let’s start by opening one solid goal-related page. I’ll use that as home base.',
    endAck: 'All wrapped. I’ll tuck the thread away for now.',
  },
  partner: {
    title: 'Hey, this looks a little away from your goal.',
    copy: 'This may be a little off your thread. Stay with it if it feels right, or I can gently bring you back.',
    relevant: 'This is useful',
    stay: 'Stay on this page',
    later: 'Remind me later',
    goal: 'OK, let’s go back to the trail',
    end: 'I want to end this session',
    verified: 'I hear you. I’ll remember this thread for the rest of the session.',
    tentative: 'I hear you. I’ll remember this thread for the rest of the session.',
    stayAck: 'Of course. Stay here; I won’t hover over this tab.',
    laterAck: 'Okay. I’ll check in later, softly.',
    backAck: 'Got you. Taking you back to the thread.',
    noBackAck: 'I don’t have a good page to return to yet, but I’m with you.',
    endAck: 'All done. I’ll stop nudging.',
  },
}

const ENCOURAGEMENT_COPY = {
  strict: {
    keep: 'Continue',
    later: 'Hide this',
    end: 'End session',
    ack: 'Good. Stay with the useful thread.',
  },
  friend: {
    keep: 'Nice, keep going',
    later: 'Cute, hide this',
    end: 'Call it a day',
    ack: 'Love it. You found a useful thread. I’ll stay out of the way.',
  },
  partner: {
    keep: 'Let me keep reading',
    later: 'Hide this for now',
    end: 'We’re done here',
    ack: 'I’m glad this is helping. I’ll give you space with it.',
  },
}

function showPrompt({ message, suggestion, goal, tone = 'friend', promptKind = 'drift' }) {
  removePrompt()
  const copy = TONE_COPY[tone] || TONE_COPY.friend
  const isEncouragement = promptKind === 'encouragement'
  const encouragement = ENCOURAGEMENT_COPY[tone] || ENCOURAGEMENT_COPY.friend

  const root = document.createElement('div')
  root.id = 'cfa-gentle-prompt'
  root.innerHTML = `
    <div class="cfa-bear" aria-hidden="true">
      <div class="cfa-ear cfa-ear-left"></div>
      <div class="cfa-ear cfa-ear-right"></div>
      <div class="cfa-face">
        <span class="cfa-eye"></span>
        <span class="cfa-eye"></span>
        <span class="cfa-nose"></span>
      </div>
      <div class="cfa-base"></div>
      <div class="cfa-paw cfa-paw-left"></div>
      <div class="cfa-paw cfa-paw-right"></div>
    </div>
    <div class="cfa-card">
      <div class="cfa-accent"></div>
      <div class="cfa-content">
        <div class="cfa-title">${escapeHtml(isEncouragement ? message : copy.title)}</div>
        <div class="cfa-copy">${escapeHtml(isEncouragement ? suggestion : copy.copy)}</div>
        <div class="cfa-goal">Current goal: ${escapeHtml(goal)}</div>
        ${isEncouragement ? `
          <div class="cfa-actions">
            <button data-action="encourage-ok" class="cfa-primary">${escapeHtml(encouragement.keep)}</button>
            <button data-action="later">${escapeHtml(encouragement.later)}</button>
            <button data-action="end">${escapeHtml(encouragement.end)}</button>
          </div>
        ` : `
          <div class="cfa-actions">
            <button data-action="relevant" class="cfa-primary">${escapeHtml(copy.relevant)}</button>
            <button data-action="stay">${escapeHtml(copy.stay)}</button>
            <button data-action="later">${escapeHtml(copy.later)}</button>
            <button data-action="goal">${escapeHtml(copy.goal)}</button>
            <button data-action="end">${escapeHtml(copy.end)}</button>
          </div>
        `}
      </div>
    </div>
  `

  const style = document.createElement('style')
  style.id = 'cfa-gentle-prompt-style'
  style.textContent = `
    #cfa-gentle-prompt {
      position: fixed;
      right: 24px;
      bottom: 24px;
      z-index: 2147483647;
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #e2e8f0;
      padding-top: 0;
      animation: cfaSlideIn 280ms ease-out forwards;
    }
    #cfa-gentle-prompt .cfa-bear {
      position: absolute;
      right: 30px;
      bottom: 100%;
      width: 86px;
      height: 66px;
      z-index: 3;
      filter: drop-shadow(0 -2px 10px rgba(15,23,42,0.2));
      transform-origin: 50% 80%;
    }
    #cfa-gentle-prompt .cfa-face {
      position: absolute;
      left: 14px;
      top: 12px;
      width: 58px;
      height: 52px;
      border-radius: 50% 50% 44% 44%;
      background: #f8fafc;
      border: 1px solid rgba(148,163,184,0.42);
    }
    #cfa-gentle-prompt .cfa-ear {
      position: absolute;
      top: 8px;
      width: 25px;
      height: 25px;
      border-radius: 50%;
      background: #f8fafc;
      border: 1px solid rgba(148,163,184,0.4);
    }
    #cfa-gentle-prompt .cfa-ear-left { left: 8px; }
    #cfa-gentle-prompt .cfa-ear-right { right: 8px; }
    #cfa-gentle-prompt .cfa-eye {
      position: absolute;
      top: 28px;
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: #334155;
      animation: cfaBearBlink 4.5s ease-in-out infinite;
    }
    #cfa-gentle-prompt .cfa-eye:first-child { left: 21px; }
    #cfa-gentle-prompt .cfa-eye:nth-child(2) { right: 21px; }
    #cfa-gentle-prompt .cfa-nose {
      position: absolute;
      left: 50%;
      top: 35px;
      width: 10px;
      height: 7px;
      transform: translateX(-50%);
      border-radius: 50%;
      background: #475569;
    }
    #cfa-gentle-prompt .cfa-base {
      position: absolute;
      left: 16px;
      bottom: 0;
      width: 54px;
      height: 10px;
      border-radius: 999px 999px 0 0;
      background: #f8fafc;
      border: 1px solid rgba(148,163,184,0.3);
      border-bottom: 0;
      z-index: 4;
    }
    #cfa-gentle-prompt .cfa-paw {
      position: absolute;
      bottom: 0;
      width: 20px;
      height: 15px;
      border-radius: 12px 12px 2px 2px;
      background: #f8fafc;
      border: 1px solid rgba(148,163,184,0.36);
      border-bottom: 0;
      z-index: 4;
    }
    #cfa-gentle-prompt .cfa-paw-left { left: 18px; }
    #cfa-gentle-prompt .cfa-paw-right { right: 18px; }
    #cfa-gentle-prompt .cfa-card {
      width: min(500px, calc(100vw - 48px));
      display: flex;
      gap: 14px;
      padding: 18px;
      border-radius: 12px;
      background: rgba(15, 23, 42, 0.88);
      border: 1px solid rgba(255,255,255,0.12);
      box-shadow: 0 18px 50px rgba(0,0,0,0.26);
      backdrop-filter: blur(18px);
      position: relative;
      z-index: 2;
      overflow: visible;
    }
    #cfa-gentle-prompt .cfa-accent {
      width: 4px;
      border-radius: 999px;
      background: linear-gradient(180deg, #a5b4fc, #10b981);
      flex: 0 0 auto;
    }
    #cfa-gentle-prompt .cfa-title {
      font-size: 16px;
      font-weight: 750;
      line-height: 1.4;
      color: rgba(248,250,252,0.94);
    }
    #cfa-gentle-prompt .cfa-copy {
      margin-top: 8px;
      font-size: 14px;
      line-height: 1.5;
      color: rgba(226,232,240,0.72);
    }
    #cfa-gentle-prompt .cfa-goal {
      margin-top: 10px;
      font-size: 13px;
      color: rgba(165,180,252,0.78);
    }
    #cfa-gentle-prompt .cfa-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 14px;
    }
    #cfa-gentle-prompt button {
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 7px;
      padding: 8px 10px;
      background: rgba(255,255,255,0.055);
      color: rgba(248,250,252,0.88);
      font: inherit;
      font-size: 13px;
      cursor: pointer;
    }
    #cfa-gentle-prompt button.cfa-primary {
      border-color: rgba(165,180,252,0.42);
      background: rgba(99,102,241,0.18);
      color: rgba(248,250,252,0.96);
      font-weight: 700;
    }
    #cfa-gentle-prompt button:hover {
      background: rgba(255,255,255,0.095);
    }
    @keyframes cfaSlideIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes cfaBearBlink {
      0%, 92%, 100% { transform: scaleY(1); }
      95% { transform: scaleY(0.18); }
    }
  `

  document.documentElement.appendChild(style)
  document.documentElement.appendChild(root)

  root.addEventListener('click', async (event) => {
    const button = event.target.closest('button')
    if (!button) return
    const action = button.dataset.action

    if (action === 'encourage-ok') {
      await chrome.runtime.sendMessage({ type: 'CFA_STAY_HERE' })
      showAcknowledgement(encouragement.ack)
    } else if (action === 'relevant') {
      await chrome.runtime.sendMessage({ type: 'CFA_MARK_RELEVANT' })
      showAcknowledgement(
        'Okay, I’ll redefine pages like this as part of your goal.',
        'This tab is now treated as goal-related for the current session.'
      )
    } else if (action === 'stay') {
      await chrome.runtime.sendMessage({ type: 'CFA_STAY_HERE' })
      showAcknowledgement(copy.stayAck)
    } else if (action === 'later') {
      await chrome.runtime.sendMessage({ type: 'CFA_REMIND_LATER' })
      showAcknowledgement(copy.laterAck)
    } else if (action === 'goal') {
      const backTitle = tone === 'strict'
        ? `Alright, let's refocus. You're here for: "${goal}".`
        : tone === 'partner'
        ? `Alright, let's head back together. You were working on: "${goal}".`
        : `Alright, let's get back on the trail! You're here to work on: "${goal}".`
      const isDriftFallback = !suggestion || suggestion.toLowerCase().startsWith('if this page is intentional')
      const backDetail = isDriftFallback
        ? `Maybe try easing back into it — you could look for something that touches on "${goal}" directly. No pressure, just a gentle nudge.`
        : `You might want to consider: ${suggestion.replace(/\.$/, '').toLowerCase()}.`
      showAcknowledgement(backTitle, backDetail, 14000)
    } else if (action === 'end') {
      await chrome.runtime.sendMessage({ type: 'CFA_END_SESSION' })
      showAcknowledgement(copy.endAck)
    }
  })
}

function showAcknowledgement(text, detail = 'Threadmate will remember this choice for the current session.', timeout = 7000) {
  const root = document.getElementById('cfa-gentle-prompt')
  if (!root) return

  const content = root.querySelector('.cfa-content')
  if (!content) {
    removePrompt()
    return
  }

  content.innerHTML = `
    <div class="cfa-title">${escapeHtml(text)}</div>
    <div class="cfa-copy">${escapeHtml(detail)}</div>
  `
  window.setTimeout(removePrompt, timeout)
}

function removePrompt() {
  document.getElementById('cfa-gentle-prompt')?.remove()
  document.getElementById('cfa-gentle-prompt-style')?.remove()
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[char])
}
