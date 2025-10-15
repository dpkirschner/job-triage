# Job Triage Browser Extension - Claude Instructions

## Project Overview

This is a **local-first, privacy-focused browser extension** that helps solo developers quickly triage and rank job listings on career pages. All processing happens locally in the browser with no backend services.

**Key Documentation:**
- `docs/product_spec.md` - Feature roadmap organized in phases (MVP → Polish)
- `docs/technical_overview.md` - Architecture, components, and design decisions

## Core Principles

1. **Privacy First**: All data (resume, scores, preferences) stays on device. No telemetry, no cloud services.
2. **Local Processing**: Use Transformers.js/ONNX for embeddings; IndexedDB for storage
3. **Performance Targets**: <1s fetch per job, <100ms scoring, handle 100+ listings
4. **Success Metrics**: Triage 30-50 roles in <5 minutes with ≥70% relevance accuracy

## Architecture Summary

**Components:**
- Content Script (overlay UI)
- Background Service Worker (network, embeddings, caching)
- Settings/Options Page (resume, preferences, profiles)
- IndexedDB Storage (jobs, embeddings, settings, profiles)

**Scoring Formula:**
```
score = 0.6 × similarity + 0.2 × keyword + 0.1 × role + 0.1 × location
```

## Using bd for Issue Tracking

**When to use bd:**
- Breaking down features from the product spec into implementable tasks
- Tracking dependencies between related work (e.g., "scoring engine blocks UI display")
- Managing multi-phase development (Phase 1 MVP → Phase 2 embeddings, etc.)
- Discovering new work during implementation (use `bd create` to capture issues)
- Before starting work, check `bd ready` to see unblocked tasks

**Workflow:**
1. **Initialize**: If not done, run `bd init` to set up issue tracking
2. **Plan Phase Work**: Create issues for each phase's deliverables with dependencies
   - Example: `bd create "Implement keyword scoring" -t feature`
   - Example: `bd dep add ui-overlay scoring-engine` (overlay depends on scoring)
3. **Check Ready Work**: Run `bd ready` to see what's unblocked and ready to start
4. **Track Progress**: Update status as you work
   - `bd update job-triage-1 --status in_progress`
   - `bd close job-triage-1 --reason "Completed in commit abc123"`
5. **Discover Dependencies**: When you find new work or blockers, create issues and link them
   - Example: `bd create "Add fallback parser for Greenhouse ATS" -d "Discovered during testing"`

**Best Practices:**
- Use issue dependencies to reflect technical blockers (embeddings need storage, UI needs scoring, etc.)
- Reference `bd` issues in commit messages for traceability
- Keep issues granular and actionable (align with product spec deliverables)
- Use `bd dep tree` to visualize work dependencies before starting complex features

**Phase-Based Issue Creation:**
- Create issues aligned with product spec phases
- Link dependencies: later phases often depend on earlier ones
- Tag issues with phase number for easy filtering (e.g., `-d "Phase 1: MVP"`)

## Development Phases (Reference)

1. **Phase 1 (MVP)**: One-click overlay, basic keyword scoring, pagination, local caching
2. **Phase 1.5**: Multi-site support, keyboard shortcuts, deduplication
3. **Phase 2**: Local embeddings (semantic similarity), export, notes
4. **Phase 3**: Multi-ATS presets, profiles, metrics
5. **Phase 4**: Pitch generation, compact UI, polish

## Technical Stack Expectations

- **Browser Extension**: Manifest V3, content scripts, service workers
- **UI**: Lightweight (consider Preact/vanilla JS for small footprint)
- **Embeddings**: Transformers.js with MiniLM model (<100MB)
- **Storage**: IndexedDB for persistence
- **Parsing**: DOM selectors + fallback heuristics

## Quick Reference Commands

```bash
# bd issue tracking
bd init                          # Initialize tracking
bd ready                         # Show unblocked work
bd create "Task name" -t feature # Create new issue
bd list --status open            # View open issues
bd dep add issue-1 issue-2       # issue-2 blocks issue-1
bd update issue-1 --status done  # Mark complete
bd dep tree issue-1              # Visualize dependencies
```

---

**Remember**: Consult the docs/ directory for detailed product and technical specs before implementing features. All design decisions should optimize for privacy, low latency, and local-first operation.
