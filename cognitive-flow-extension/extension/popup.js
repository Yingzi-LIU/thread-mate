const goalEl = document.getElementById('goal')
const startEl = document.getElementById('start')
const endEl = document.getElementById('end')
const importTabsEl = document.getElementById('import-tabs')
const stateTextEl = document.getElementById('state-text')
const stateDotEl = document.getElementById('state-dot')

async function loadState() {
  const { cfaSession } = await chrome.storage.local.get('cfaSession')
  if (cfaSession?.active) {
    goalEl.value = cfaSession.goal
    setTone(cfaSession.tone || 'friend')
    stateTextEl.textContent = `Active: ${cfaSession.goal}`
    stateDotEl.classList.add('active')
  } else {
    stateTextEl.textContent = 'No active session'
    stateDotEl.classList.remove('active')
  }
}

startEl.addEventListener('click', async () => {
  const goal = goalEl.value.trim()
  if (!goal) return
  await chrome.runtime.sendMessage({ type: 'CFA_START_SESSION', goal, tone: getTone() })
  await loadState()
})

endEl.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'CFA_END_SESSION' })
  await loadState()
})

importTabsEl.addEventListener('click', async () => {
  importTabsEl.disabled = true
  const previousLabel = importTabsEl.textContent
  importTabsEl.textContent = 'Sending tabs…'

  try {
    const response = await chrome.runtime.sendMessage({ type: 'CFA_IMPORT_TABS_TO_APP' })
    stateTextEl.textContent = `Sent ${response?.count || 0} tab${response?.count === 1 ? '' : 's'} to the app`
    importTabsEl.textContent = 'Sent to Threadmate'
  } catch {
    stateTextEl.textContent = 'Could not reach the app on port 8000'
    importTabsEl.textContent = 'Try Again'
  } finally {
    window.setTimeout(() => {
      importTabsEl.disabled = false
      importTabsEl.textContent = previousLabel
    }, 1600)
  }
})

loadState()

function getTone() {
  return document.querySelector('input[name="tone"]:checked')?.value || 'friend'
}

function setTone(tone) {
  const input = document.querySelector(`input[name="tone"][value="${tone}"]`)
  if (input) input.checked = true
}
