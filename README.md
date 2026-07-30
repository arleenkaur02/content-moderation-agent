# Content Moderation Escalation Agent

**An AI agent that triages flagged content the way a Trust & Safety team would.** It scores each report for policy violation type, severity, and false-positive likelihood, auto-actions the clear-cut cases, and routes ambiguous or high-stakes content to a human reviewer with a generated rationale and policy citation — never guessing on the categories where guessing wrong matters most.

Modeled on the trust-and-safety triage problem large platforms (Meta, YouTube, Reddit) run at massive scale: most reports are unambiguous, a meaningful minority genuinely need a human, and the cost of getting that split wrong — in either direction — is real.

## Why this exists

The interesting design decision in content moderation isn't "detect bad content" — it's knowing when *not* to trust the automated decision. This project encodes that explicitly: self-harm and violence content is biased toward escalation regardless of report volume, because the cost of a wrong auto-decision in those categories is too high to risk, while a clear spam pattern with strong signal is safe to auto-remove. That's the judgment layer that makes this more than a classifier wrapper.

## Architecture

```
Flagged Content ──▶ Classification Engine (Claude + policy heuristics)
                            │
              action + severity + false-positive likelihood
                    + confidence + rationale + policy cite
                            │
              ┌─────────────┴─────────────┐
        Auto-actioned                Escalated to
      (remove / approve)            human review queue
```

**Pipeline stages:**

1. **Ingestion** — `POST /webhooks/flagged-content` accepts a normalized flagged-content event (category, caption/description, report count, author's prior violation count).
2. **Classification engine** — a Claude-powered agent weighs report volume, author history, and category severity together, with an explicit bias: self-harm and violence route to human review regardless of signal strength, while clear-pattern spam auto-removes. Falls back to a deterministic rule set if no API key is configured.
3. **Routing** — auto-remove, auto-approve, or escalate, each with a policy citation and plain-language rationale a human reviewer (or an auditor) can actually read.

The dashboard adds: a **review console** showing only escalated items with mock approve/reject actions, a **3D risk orbit** (Three.js) visualizing policy categories orbiting a central Trust & Safety core — pulsing when a new item in that category fires — an **analytics** view computed live from the session, and a **chatbot** for querying moderation decisions.

## Tech stack

| Layer | Choice |
|---|---|
| Language | TypeScript / Node.js |
| Reasoning | Anthropic Claude API (`@anthropic-ai/sdk`) |
| Server | Express |
| 3D visualization | Three.js (risk orbit — categories orbiting a core, pulsing on new flags) |
| Frontend | Vanilla HTML/CSS/JS — sidebar console layout, dark grey/red theme |

## Getting started

```bash
git clone https://github.com/arleenkaur02/content-moderation-agent.git
cd content-moderation-agent
npm install
cp .env.example .env   # optional — the demo runs without any keys
```

**Run the simulation** (no server, no API keys needed):

```bash
npm run simulate
```

**Run the live server:**

```bash
npm run dev
```

Then open `http://localhost:4000` for the full console, or POST directly:

```bash
curl -X POST http://localhost:4000/webhooks/flagged-content \
  -H "Content-Type: application/json" \
  -d '{
    "contentType": "image",
    "category": "violence",
    "caption": "Post reported by 14 users for graphic content.",
    "thumbnailUrl": "https://picsum.photos/seed/demo/300/200",
    "reportCount": 14,
    "authorPriorViolations": 2,
    "platform": "Community Feed",
    "timestamp": "2026-07-28T10:12:00Z"
  }'
```

To get real LLM-generated reasoning instead of the heuristic fallback, add your key to `.env`:

```
ANTHROPIC_API_KEY=your_key_here
```

## Console pages

- **Moderation queue** — flag sample content, filter by decision, see thumbnails and rationale for each item.
- **Review console** — escalated items only, with the full policy citation and rationale a human reviewer needs.
- **Risk orbit** — a live, rotatable 3D scene: policy categories orbit a central core, color-coded by severity, pulsing when a new flag lands in that category.
- **Analytics** — total flagged, escalation rate, auto-removal count, confidence breakdown.
- **Ask the agent** — a chatbot backed by Claude with the live moderation log as context.

## What I'd add with more time

- Persist decisions to a real database and build the review console's approve/reject buttons into an actual feedback loop that recalibrates the classifier.
- Real image/video content analysis (currently metadata-only — caption, report count, category — no actual media inspection).
- A confusion-matrix view comparing agent decisions against eventual human review outcomes, to track false-positive/false-negative rates over time.
- Multi-language policy handling — the current policy references are English-only.

## Project structure

```
src/
  index.ts                    Express server (webhook, moderation, categories, chat endpoints)
  simulate.ts                 Standalone runner — no server/keys required
  orchestrator.ts              Wires the full pipeline together
  moderationStore.ts           Shared in-memory moderation history
  services/
    classificationEngine.ts    Claude-powered classifier + heuristic fallback
    chatAgent.ts                Powers the "Ask the agent" page
  data/                         Mock flagged content, policy category metadata
  types/                        Shared TypeScript interfaces
public/
  index.html                    Sidebar console UI with 3D risk orbit visualization
```

---

Built by [Arleen Kaur Teerthy](https://github.com/arleenkaur02) as part of a series of production-style AI agent projects.
