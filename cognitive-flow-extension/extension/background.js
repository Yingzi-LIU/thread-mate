const API_BASE = 'http://127.0.0.1:8010'
const APP_API_BASE = 'http://127.0.0.1:8000'
const DRIFT_SECONDS = 10
const CHECK_INTERVAL_MS = 5000

let activeTabId = null
let activeSince = Date.now()
let visitIndex = 0
let lastAlignedTabId = null
const mutedTabs = new Set()
const snoozedUntil = new Map()
const promptedTabs = new Set()

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({ cfaSession: { active: false, goal: '', tone: 'friend' } })
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse)
  return true
})

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  activeTabId = tabId
  activeSince = Date.now()
  visitIndex += 1
  promptedTabs.delete(tabId)
  await analyzeActiveTab()
})

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status === 'complete') {
    await maybeTrackSessionTab(tabId)
  }

  if (tabId === activeTabId && changeInfo.status === 'complete') {
    activeSince = Date.now()
    promptedTabs.delete(tabId)
    await analyzeActiveTab()
  }
})

chrome.tabs.onCreated.addListener(async (tab) => {
  if (tab.id) await maybeTrackSessionTab(tab.id)
})

setInterval(analyzeActiveTab, CHECK_INTERVAL_MS)

async function handleMessage(message, sender) {
  if (message.type === 'CFA_START_SESSION') {
    const goal = normalizeGoalTitle(message.goal)
    const tone = ['strict', 'friend', 'partner'].includes(message.tone) ? message.tone : 'friend'
    const existingTabs = await chrome.tabs.query({})
    const baselineTabIds = existingTabs
      .filter((tab) => tab.id)
      .map((tab) => tab.id)
    const startedAt = new Date().toISOString()

    await fetchJson('/session/start', { goal })
    await chrome.storage.local.set({
      cfaSession: { active: true, goal, tone, startedAt },
      cfaImportScope: { startedAt, baselineTabIds, trackedTabIds: [] },
    })
    await pushSessionToApp(goal, tone, startedAt)
    activeSince = Date.now()
    visitIndex = 0
    lastAlignedTabId = null
    promptedTabs.clear()
    mutedTabs.clear()
    snoozedUntil.clear()
    await analyzeActiveTab()
    return { ok: true }
  }

  if (message.type === 'CFA_END_SESSION') {
    await fetchJson('/session/end', {})
    await chrome.storage.local.set({
      cfaSession: { active: false, goal: '', tone: 'friend', startedAt: '' },
      cfaImportScope: { startedAt: '', baselineTabIds: [], trackedTabIds: [] },
    })
    lastAlignedTabId = null
    promptedTabs.clear()
    mutedTabs.clear()
    snoozedUntil.clear()
    return { ok: true }
  }

  if (message.type === 'CFA_IMPORT_TABS_TO_APP') {
    return importTabsToApp()
  }

  if (message.type === 'CFA_STAY_HERE' && sender.tab?.id) {
    mutedTabs.add(sender.tab.id)
    promptedTabs.add(sender.tab.id)
    return { ok: true }
  }

  if (message.type === 'CFA_MARK_RELEVANT' && sender.tab?.id) {
    const result = await fetchJson('/feedback/relevant', {
      tab_id: sender.tab.id,
      label: 'relevant',
      reason: message.reason || '',
    })
    lastAlignedTabId = sender.tab.id
    mutedTabs.add(sender.tab.id)
    promptedTabs.add(sender.tab.id)
    return result
  }

  if (message.type === 'CFA_REMIND_LATER' && sender.tab?.id) {
    snoozedUntil.set(sender.tab.id, Date.now() + 5 * 60 * 1000)
    promptedTabs.delete(sender.tab.id)
    return { ok: true }
  }

  if (message.type === 'CFA_BACK_TO_GOAL') {
    const { cfaSession } = await chrome.storage.local.get('cfaSession')
    if (lastAlignedTabId && lastAlignedTabId !== sender.tab?.id) {
      try {
        await chrome.tabs.update(lastAlignedTabId, { active: true })
        return { ok: true, goal: cfaSession?.goal || '', switched: true }
      } catch {
        lastAlignedTabId = null
      }
    }
    return { ok: true, goal: cfaSession?.goal || '', switched: false }
  }

  return { ok: false }
}

async function analyzeActiveTab() {
  const { cfaSession } = await chrome.storage.local.get('cfaSession')
  if (!cfaSession?.active || !activeTabId) return
  if (mutedTabs.has(activeTabId)) return
  if ((snoozedUntil.get(activeTabId) || 0) > Date.now()) return

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab || !tab.id || tab.id !== activeTabId || !isAnalyzableUrl(tab.url || '')) return

  const activeDuration = Math.floor((Date.now() - activeSince) / 1000)
  const page = await getPageSnapshot(tab.id)
  const payload = {
    tab_id: tab.id,
    url: tab.url || '',
    title: page.title || tab.title || '',
    text: page.text || '',
    active_duration: activeDuration,
    visit_index: visitIndex,
  }

  try {
    const result = await fetchJson('/analyze-tab', payload)
    if (result?.node?.alignment_category === 'aligned') {
      lastAlignedTabId = tab.id
    }
    if (
      result?.reflection?.should_prompt &&
      activeDuration >= DRIFT_SECONDS &&
      !promptedTabs.has(tab.id)
    ) {
      promptedTabs.add(tab.id)
      await chrome.tabs.sendMessage(tab.id, {
        type: 'CFA_SHOW_PROMPT',
        message: result.reflection.soft_message,
        suggestion: result.reflection.suggestion,
        promptKind: result.reflection.prompt_kind || 'drift',
        goal: cfaSession.goal,
        tone: cfaSession.tone || 'friend',
      })
    }
  } catch (error) {
    console.warn('[CFA] analysis failed', error)
  }
}

async function getPageSnapshot(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, { type: 'CFA_EXTRACT_PAGE' })
  } catch {
    return { title: '', text: '' }
  }
}

async function fetchJson(path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
  return response.json()
}

async function importTabsToApp() {
  const { cfaSession, cfaImportScope } = await chrome.storage.local.get(['cfaSession', 'cfaImportScope'])
  const tabs = await chrome.tabs.query({})
  const trackedTabIds = new Set(cfaImportScope?.trackedTabIds || [])
  const analyzableTabs = tabs.filter((tab) => (
    tab.id &&
    trackedTabIds.has(tab.id) &&
    isAnalyzableUrl(tab.url || '')
  ))

  const importedTabs = await Promise.all(
    analyzableTabs.map(async (tab) => {
      const snapshot = await getPageSnapshot(tab.id)
      const text = snapshot?.text || ''
      const contentPreview = buildContentPreview(text, tab.title || '', tab.url || '')

      return {
        id: `browser-tab-${tab.id}`,
        tab_id: tab.id,
        window_id: tab.windowId,
        index: tab.index,
        title: snapshot?.title || tab.title || 'Untitled tab',
        url: tab.url || '',
        type: inferPageType(tab.url || '', tab.title || ''),
        content_preview: contentPreview,
        active: Boolean(tab.active),
      }
    })
  )

  const response = await fetch(`${APP_API_BASE}/imports/tabs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: 'chrome-extension',
      goal: cfaSession?.goal || '',
      imported_at: new Date().toISOString(),
      tabs: importedTabs,
    }),
  })

  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
  const result = await response.json()
  return { ok: true, count: result.count || importedTabs.length }
}

async function pushSessionToApp(goal, tone, startedAt) {
  try {
    await fetch(`${APP_API_BASE}/imports/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'chrome-extension',
        goal,
        tone,
        started_at: startedAt,
      }),
    })
  } catch {
    // The original app may be closed; the extension session can still run.
  }
}

async function maybeTrackSessionTab(tabId) {
  const { cfaSession, cfaImportScope } = await chrome.storage.local.get(['cfaSession', 'cfaImportScope'])
  if (!cfaSession?.active || !cfaImportScope?.startedAt) return

  const baseline = new Set(cfaImportScope.baselineTabIds || [])
  if (baseline.has(tabId)) return

  const tracked = new Set(cfaImportScope.trackedTabIds || [])
  if (tracked.has(tabId)) return

  tracked.add(tabId)
  await chrome.storage.local.set({
    cfaImportScope: {
      ...cfaImportScope,
      trackedTabIds: Array.from(tracked),
    },
  })
}

function isAnalyzableUrl(url) {
  return /^https?:\/\//.test(url)
}

function buildContentPreview(text, title, url) {
  const clean = [title, text, url]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  return clean.slice(0, 1200)
}

function inferPageType(url, title) {
  const value = `${url} ${title}`.toLowerCase()
  if (/youtube\.com|youtu\.be|vimeo\.com|video/.test(value)) return 'video'
  if (/maps\.google|openstreetmap|map/.test(value)) return 'map'
  if (/news|bbc|cnn|nytimes|reuters|apnews|lemonde|theguardian/.test(value)) return 'news'
  return 'web'
}

function normalizeGoalTitle(value) {
  const clean = value.trim().replace(/\s+/g, ' ') || 'Untitled Research Goal'
  const smallWords = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'vs', 'with'])
  const words = clean.split(' ')
  return words.map((word, index) => {
    if (word === word.toUpperCase() && word.length <= 4) return word
    const lower = word.toLowerCase()
    if (index > 0 && index < words.length - 1 && smallWords.has(lower)) return lower
    return lower.charAt(0).toUpperCase() + lower.slice(1)
  }).join(' ')
}
