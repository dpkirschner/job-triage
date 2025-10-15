# Job Triage Browser Extension — Feature Plan (Solo Developer)

## Overview

Goal: Build a browser extension that helps a solo developer triage job listings on any careers page quickly, locally, and privately. The extension overlays a ranked, scored list of roles with minimal setup and no external dependencies.

---

## Phase 1 — MVP: Fast Triage on One Site

**Objective:** Enable rapid filtering and triage on a single target site.

**Features:**

* One-click overlay on the current careers page.
* Job card detection and listing parsing.
* Basic pagination (page numbers, limit/offset, or "Scan more" for infinite scroll).
* Local scoring v1:

  * Keyword-based stack and role matching.
  * Hard filters for level and location.
  * Threshold slider to "show ≥ N."
* Decision controls:

  * 👍 opens job tab.
  * 👎 hides job and remembers decision.
  * “Open all 👍” button.
* Resume and preferences:

  * Paste resume once.
  * Select preferred stacks and role types.
* Caching:

  * Skip re-scanning identical URLs.

**Deliverables:**

* Functional overlay for one site.
* Settings panel for resume and preferences.
* Local cache (e.g., IndexedDB) for jobs and decisions.

**Acceptance Criteria:**

* Triage 30+ jobs in under 5 minutes.
* ≥70% thumbs-up relevance accuracy.
* Decisions persist across page reloads.

---

## Phase 1.5 — Quality & Resilience

**Objective:** Improve reliability and UX polish.

**Features:**

* Second-site adapter (e.g., Lever or Greenhouse).
* Parsing fallback for selector failures.
* Progress bar with cancel/resume.
* De-duplication across paginated pages.
* "Why this score" explanation (top 3 matches + 1 red flag).
* Keyboard shortcuts (J/K navigate, L = 👍, H = 👎, O = open).

**Deliverables:**

* Reliable parsing on two ATS platforms.
* Clear progress and error recovery.
* Keyboard-driven workflow.

**Acceptance Criteria:**

* Two ATS sites supported without manual edits.
* No duplicates across pages.
* Full triage workflow possible without mouse.

---

## Phase 2 — Relevance Upgrade & Productivity Loop

**Objective:** Improve ranking quality and user control.

**Features:**

* Local embeddings for semantic similarity (resume ↔ JD).
* Scoring weights panel for tuning similarity vs keywords vs role/location.
* Quick-compare drawer (compare 2–3 jobs side by side).
* Notes and tags for each role.
* Export kept roles (CSV/Markdown with link, score, and rationale).

**Deliverables:**

* Combined similarity + heuristic scoring.
* Persistent scoring weights.
* Export-ready shortlist.

**Acceptance Criteria:**

* Clear improvement in ranking accuracy.
* Exports open cleanly in spreadsheet.
* Notes persist between sessions.

---

## Phase 3 — Personalization & Scale

**Objective:** Support more ATS pages and larger job lists efficiently.

**Features:**

* Per-site selector presets (3–5 ATS variants).
* Polite concurrency (limit concurrent requests, add backoff).
* Session metrics: jobs scanned, kept, opened, time saved.
* Profile presets (e.g., “Seattle Hybrid,” “Remote OK,” “Infra-heavy”).
* Opportunity heat tags (e.g., “Streaming,” “Infra,” “SRE-ish”).

**Deliverables:**

* Stable multi-site support.
* Overlay footer with metrics.
* Switchable profiles.

**Acceptance Criteria:**

* 100+ jobs scanned without crashes.
* Profile toggle updates instantly (<1s latency).
* Metrics accurate within 10%.

---

## Phase 4 — Delight & Polish

**Objective:** Refine UX and add light personalization.

**Features:**

* 3-sentence pitch (local template).
* Time-to-apply heuristic (short vs long application).
* Saved shortlists for later review.
* Compact UI mode with sticky header and quick filters.

**Deliverables:**

* Inline pitch for kept roles.
* Saved shortlist management.
* Clean, compact list view.

**Acceptance Criteria:**

* Pitch reads well for 80%+ of jobs.
* Shortlists reload accurately.
* Compact mode fits 50%+ more items without scroll.

---

## Non-Goals

* No auto-apply or ATS automation.
* No backend or data aggregation.
* No cloud-based agents.
* No resume rewriting beyond pitch template.

---

## Success Metrics

* **Triage velocity:** 30–50 roles in <5 minutes.
* **Precision:** ≥70% thumbs-up relevance.
* **Friction:** ≤1 click to start; ≤3 settings changed.
* **Trust:** Fully usable without cloud access.

---

## Summary for Coding Models

The system’s purpose is to locally rank and triage job listings inside a browser environment, providing a human-centric overlay that helps a single developer decide which roles are worth opening. Implementation choices (runtime, model, data storage) should always optimize for:

* Low latency and small footprint.
* Privacy (local processing only).
* Compatibility across major ATS sites.
* Progressive rollout in feature phases above.
