# Threadmate for Chrome

Chrome extension prototype for goal-aware cognitive flow analysis.

This is a separate project from the existing demo app. It does not modify the original `backend/` or `frontend/` folders.

## What It Does

- User starts a focus session from the extension popup.
- The extension observes active tab order and active duration during that session.
- Page title, URL, meta description, headings, and a small text sample are sent to the local agent backend.
- The backend classifies the tab as `aligned`, `expansion`, or `drift`.
- If a drift tab stays active for more than 30 seconds, the page receives a gentle prompt:

> Your research thread is drifting from the current goal.

The user can choose:

- This helps my goal
- Stay here
- Remind me later
- Back to goal
- End session

`This helps my goal` is the correction path. The user does not need to justify it in the MVP. The backend treats the click as feedback, then runs a lightweight self-check before learning from it:

1. The analyzer saw at least a weak relevance signal.
2. The page has enough topical evidence.
3. The page bridges back to the current goal or learned session terms.

When enough checks pass, the session learns from that page. Otherwise, the feedback is acknowledged but not learned.

The popup also supports three tone modes:

- Strict coach mode
- Friend mode
- Partner mode

## Local Backend

Run the agent backend on port `8010`:

```bash
cd cognitive-flow-extension/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8010 --reload
```

Health check:

```bash
curl http://127.0.0.1:8010/
```

## Load the Chrome Extension

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select:

```txt
cognitive-flow-extension/extension
```

5. Click the extension icon.
6. Enter a goal and start a session.

## Send Tabs to the Threadmate App

The extension can hand the current browser tabs to the original Threadmate app:

1. Start the original app backend on `http://127.0.0.1:8000`.
2. Start the original app frontend on `http://localhost:3001`.
3. Click the Threadmate extension icon.
4. Click `Send New Tabs to App`.
5. In the app left Page panel, click `Import Browser Tabs`.

Only tabs opened after the Threadmate extension session starts are sent. The app will list the imported tabs in browser order and send them through the existing page analysis, graph, and reflection flow.

To sync the research goal into the original app, start a session in the extension, then click `Import Goal from Extension` in the app Research Goal panel.

## Privacy Posture

This prototype only runs after the user starts a session. The extension sends a short page snapshot to the local backend only:

- URL
- title
- meta description
- headings
- first few paragraphs

No cloud service is used in this MVP.

## Notes

- The first version uses lightweight local keyword analysis.
- It keeps the same conceptual structure as the original app: cognitive state, tab/page analyzer, drift detector, and reflection agent.
- A future version can replace the local analyzer with embeddings or a model API, but that should be opt-in because page text may leave the device.
