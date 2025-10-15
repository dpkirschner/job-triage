Job Triage Browser Extension — Technical Overview (Expanded)

1. Purpose and Scope

Goal: Build a local-first browser extension that helps a solo developer triage job listings directly within a careers page. The tool should:
	•	Run entirely in-browser, no backend.
	•	Overlay a clean, responsive interface.
	•	Parse, score, and rank listings by fit to the user’s resume and preferences.
	•	Provide a fast, private, single-click workflow.

The product is a personal triage companion, not a scraper or aggregator.

⸻

2. High-Level Architecture

Core Components
	1.	Content Script (Overlay Layer)
	•	Injects the overlay UI.
	•	Scans the visible job list.
	•	Manages user interactions (filter, thumbs, notes, etc.).
	•	Communicates with the background worker.
	2.	Background Service Worker
	•	Handles network requests (bypassing CORS restrictions).
	•	Extracts text and computes local embeddings.
	•	Manages caching, concurrency, and backoff.
	3.	Settings / Options Page
	•	Stores resume text, preferred stacks, filters, and scoring weights.
	•	Provides profile presets (e.g., “Remote OK”, “Infra-heavy”).
	4.	Local Storage Layer (IndexedDB)
	•	Stores job data, scores, preferences, embeddings, and cached models.
	•	Enables offline use and persistence across sessions.

⸻

3. Major Design Sections

3.1 Overlay UI (Primary Product Surface)

Purpose: Provide an intuitive, compact triage interface.

Design elements:
	•	Header: site name, scan progress, threshold slider.
	•	Job list: score, title, 3-sentence pitch, action buttons.
	•	Controls: 👍 👎, open, compare, note, tags.
	•	Footer: “Open all 👍”, “Export kept”, “Scan more”, “Settings”.
	•	Side drawer (optional): job details, rationale, and notes.

Key states: idle, scanning, partial results, complete, error.
Density modes: standard and compact.
Accessibility: full keyboard support, focus order, ARIA roles, dark/light themes.

Wireframe (list layout)

┌─────────────────────────────────────────────────────────────────────────┐
│ Job Triage • 12/36 analyzed   [Show ≥7 ▢▢▢▢▢]  Sort: Score ▼            │
│ Filters: [Backend] [Platform] [Remote OK] [Clear]                      │
├─────────────────────────────────────────────────────────────────────────┤
│ 8.6  Sr Backend Eng (Infra)   Why? Pitch 👍 👎 Open                     │
│     • Kafka, Flink, AWS • Seattle Hybrid • Senior                     │
│     • Note: ask about on-call                                         │
│                                                                       │
│ 8.2  Staff Platform Eng        Why? Pitch 👍 👎 Open                    │
│     • Streaming, Reliability • Remote OK • Senior                     │
│                                                                       │
│ 7.4  Sr SWE (Services)         Why? Pitch 👍 👎 Open                    │
│     • Distributed systems • AWS • unclear team fit                    │
│                                                                       │
│ 5.9  Sr Full-Stack Eng (UI)    Why? Pitch    👎                         │
│     • UI-heavy, missing infra focus                                   │
├─────────────────────────────────────────────────────────────────────────┤
│ Open all 👍   Compare(0)   Export kept   Scan more   Settings          │
└─────────────────────────────────────────────────────────────────────────┘

Deliverables:
	•	Wireframes for list and drawer variants.
	•	Component inventory (Header, Row, WhyPopover, PitchChip, Drawer).
	•	Interaction map (mouse + keyboard).

Acceptance:
	•	30+ jobs triaged without fatigue.
	•	All actions available via keyboard.
	•	Feedback for scan progress and errors.

⸻

3.2 Page Scanner & Pagination Detection

Purpose: Automatically enumerate listings on current careers page.

Design goals:
	•	Recognize pagination pattern (offset, page, scroll).
	•	“Scan more” control for infinite scroll sites.
	•	Stable unique job identity (URL normalization).

Deliverables:
	•	Pagination heuristics and selector presets.
	•	Retry and stop logic with clear UX states.

⸻

3.3 Job Detail Retrieval & Text Extraction

Purpose: Pull job descriptions for scoring.

Design goals:
	•	Background fetch with session context.
	•	Extract readable text (boilerplate stripped).
	•	Cache text per job to avoid re-fetching.

Deliverables:
	•	Extraction policy and sanitization rules.
	•	Cache invalidation and TTL policy.

⸻

3.4 Scoring Framework

Purpose: Produce consistent, explainable job fit scores.

Signals:
	•	Semantic similarity (resume ↔ JD embedding)
	•	Keyword alignment (stack, tech, responsibilities)
	•	Role/level alignment (backend/platform > full-stack/UI)
	•	Location/work-style match (hybrid/remote weighting)

Conceptual formula:

score = 0.6 * similarity + 0.2 * keyword + 0.1 * role + 0.1 * location

Deliverables:
	•	Scoring weight matrix.
	•	Keyword taxonomy and boosts.
	•	Red-flag conditions.

⸻

3.5 Local Model Architecture

Purpose: Run embeddings locally for privacy and speed.

Design:
	•	Framework: Transformers.js or ONNX Runtime Web.
	•	Model: all-MiniLM-L6-v2 (quantized <100MB).
	•	Embedding persistence for resume; per-page embeddings cached.
	•	Fallback: keyword-only if model unavailable.

Deliverables:
	•	Model selection doc and performance targets.
	•	Compatibility matrix (WebGPU/WASM fallback).

⸻

3.6 Data & Caching

Purpose: Persist results and preferences efficiently.

Storage: IndexedDB with tables:
	•	jobs: {url, title, jd, score, reasons, decision}
	•	embeddings: {hash, vector, modelVersion}
	•	settings: {resume, preferences, weights}
	•	profiles: {name, filters, weights}

Deliverables:
	•	Schema diagram.
	•	Eviction and migration policies.

⸻

3.7 Settings & Profiles

Purpose: User customization of preferences.

Features:
	•	Paste resume once.
	•	Select stacks, role types, and locations.
	•	Tune scoring weights.
	•	Create and switch between profiles.

Deliverables:
	•	Settings IA (information architecture).
	•	Profile model and defaults.

⸻

3.8 Performance & Concurrency

Purpose: Ensure smooth scanning and responsive UI.

Design:
	•	Limit to 3–5 concurrent fetches.
	•	Report progress live.
	•	Allow cancel/resume.

Deliverables:
	•	Concurrency control logic.
	•	Progress and cancellation state machine.

⸻

3.9 Privacy & Security

Principles:
	•	Resume and scoring data never leave the device.
	•	No third-party telemetry or analytics.
	•	Explicit opt-in for any cloud calls.

Deliverables:
	•	Data flow diagram.
	•	Permissions justification list.

⸻

3.10 Errors & Edge Cases

Goals:
	•	Meaningful errors instead of silent failure.
	•	Partial results usable if some fetches fail.
	•	Retry/backoff for transient errors.

Deliverables:
	•	Error taxonomy and UX copy.
	•	Retry and recovery flow diagram.

⸻

3.11 Metrics (Local Only)

Purpose: Measure value and performance without external logging.

Metrics:
	•	Jobs scanned, kept, opened.
	•	Estimated time saved.
	•	Avg. score and precision.

Deliverables:
	•	Local metrics schema.
	•	Overlay metrics panel mock.

⸻

3.12 Accessibility & Theming

Goals:
	•	Keyboard navigation and focus indicators.
	•	Color contrast compliance.
	•	Dark/light and reduced-motion support.

Deliverables:
	•	A11y checklist.
	•	Theming token guide.

⸻

4. Technical Tradeoffs

Decision	Reason	Tradeoff
Local-only scoring	Privacy, simplicity	CPU-bound, slower on weak devices
MiniLM embeddings	Balance between speed & quality	Slight accuracy drop
IndexedDB	Persistent, async, large capacity	Complex querying
Per-site adapters	Simplicity, reliability	Minor maintenance overhead
Overlay UI	Real-time interaction	Coupled to DOM structure


⸻

5. Technical Success Metrics
	•	<1s fetch latency per job
	•	<100ms scoring time per job
	•	100+ listings handled without crash
	•	<300MB total memory footprint
	•	Overlay non-intrusive and stable

⸻

6. Summary

The system is a local browser intelligence layer that transforms job listings into structured, ranked insights. Every design decision emphasizes:
	•	Privacy: No data leaves the device.
	•	Immediacy: One click to actionable results.
	•	Explainability: Every score justified.
	•	Simplicity: Minimal moving parts; robust defaults.

This structure provides clear domains for detailed design work — UI, scanning, scoring, model, caching, settings, performance, privacy, and accessibility — each with concrete deliverables for implementation.
