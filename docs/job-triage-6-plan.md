# Job Triage Issue #6: Keyword Scoring Engine - Implementation Plan

## Overview

Build the core scoring engine that ranks jobs based on keyword matching, role/location filters, and provides explainable scores.

**Status**: Ready to implement (all dependencies closed)

**Phase**: MVP (Phase 1) - Keyword-only scoring
- ✅ Phase 2 will add embeddings/semantic similarity
- ✅ This implementation focuses on heuristic scoring only

---

## Dependencies Status

✅ **job-triage-5**: Text extraction (CLOSED) - Can extract clean JD text
✅ **job-triage-7**: IndexedDB storage (CLOSED) - Schema ready for score/reasons
✅ **job-triage-8**: Settings page (CLOSED) - Resume, stacks, roles, location prefs available

**Unblocks**: job-triage-10 (Job list renderer needs scores to display)

---

## Current State

### What We Have
- ✅ Job, Settings, Profile types defined (src/shared/types.ts)
- ✅ Storage layer with CRUD operations (src/shared/storage.ts)
- ✅ Text extraction system (src/background/extractor.ts)
- ✅ Settings page for resume/preferences (src/options/index.ts)
- ✅ Default scoring weights in constants.ts

### What We're Missing
- ❌ Scoring algorithm implementation
- ❌ Keyword matching logic
- ❌ Role/location filtering logic
- ❌ Score explanation generation
- ❌ Background worker integration for scoring
- ❌ Message handling for COMPUTE_SCORE

---

## Scoring Formula (Phase 1 MVP)

```
score = 0.2 * keyword + 0.1 * role + 0.1 * location + 6.0 (baseline)
```

**Note**: Similarity component (0.6 weight) will be added in Phase 2 with embeddings.
For now, we use a baseline of 6.0 and focus on keyword/role/location adjustments.

### Score Components

#### 1. Keyword Score (weight: 0.2)
- Match job description against:
  - Resume keywords (extracted from resume text)
  - Preferred stacks (from settings)
  - Technical terms, frameworks, languages
- **Scoring**: ratio of matched keywords to total important keywords
- **Max contribution**: 2.0 points

#### 2. Role Score (weight: 0.1)
- Match job title/description against preferred roles
- Examples: "Backend Engineer", "Platform Engineer", "SRE"
- Penalize mismatches (e.g., "Frontend" when user prefers backend)
- **Max contribution**: 1.0 point

#### 3. Location Score (weight: 0.1)
- Match job location/work style against preferences:
  - Remote: matches "Remote", "Work from home"
  - Hybrid: matches "Hybrid", "Flexible"
  - Onsite: matches specific cities
- Hard filter: disqualify if location incompatible
- **Max contribution**: 1.0 point

#### 4. Baseline (6.0)
- Starting score for any job
- Ensures scores are in 0-10 range

---

## Implementation Plan

### Phase 1: Core Scoring Module

**File**: `src/background/scorer.ts`

```typescript
// Core exports:
export interface ScoringResult {
  score: number;
  reasons: string[];
  breakdown: {
    keyword: number;
    role: number;
    location: number;
    baseline: number;
  };
}

export async function scoreJob(
  job: Partial<Job>,
  settings: Settings
): Promise<ScoringResult>

// Internal functions:
function extractKeywords(text: string): string[]
function computeKeywordScore(job, resume, stacks): number
function computeRoleScore(job, preferredRoles): number
function computeLocationScore(job, locationPrefs): number
function generateReasons(breakdown, matches): string[]
```

**Tasks**:
1. Create scorer.ts module
2. Implement keyword extraction from resume and job description
3. Implement keyword matching algorithm
4. Implement role matching logic
5. Implement location matching logic
6. Implement score explanation generator
7. Combine into scoreJob() function

---

### Phase 2: Keyword Extraction & Matching

**Algorithm**:
1. **Extract keywords** from resume and JD:
   - Tokenize text (lowercase, split on whitespace/punctuation)
   - Filter stop words (the, and, or, etc.)
   - Identify technical terms:
     - Programming languages (Python, Java, Go, Rust, etc.)
     - Frameworks (React, Django, Kafka, Kubernetes, etc.)
     - Tools (Docker, Git, AWS, PostgreSQL, etc.)
   - Extract bigrams for phrases ("machine learning", "distributed systems")

2. **Match keywords**:
   - Count matches between resume keywords and JD keywords
   - Boost matches for preferred stacks
   - Calculate ratio: matches / total_important_keywords
   - Normalize to 0-1 range

**Data structures**:
```typescript
// Known tech keywords (starter set, can expand)
const TECH_KEYWORDS = {
  languages: ['python', 'java', 'javascript', 'typescript', 'go', 'rust', ...],
  frameworks: ['react', 'django', 'flask', 'kafka', 'kubernetes', ...],
  tools: ['docker', 'git', 'aws', 'gcp', 'postgresql', 'redis', ...],
  concepts: ['distributed systems', 'machine learning', 'devops', ...]
};

// Stop words to filter out
const STOP_WORDS = new Set(['the', 'and', 'or', 'but', 'in', 'on', ...]);
```

---

### Phase 3: Role & Location Matching

#### Role Matching
- Extract role signals from job title and first paragraph of JD
- Match against preferredRoles from settings
- Scoring:
  - **+1.0**: Strong match (job title contains preferred role)
  - **+0.5**: Partial match (description mentions preferred role)
  - **-0.5**: Mismatch (job emphasizes non-preferred role)
  - **0.0**: Neutral (no clear role signal)

#### Location Matching
- Extract location signals from job metadata and description
- Match against locationPreferences:
  - **Remote**: keywords "remote", "work from anywhere", "distributed"
  - **Hybrid**: keywords "hybrid", "flexible", "office optional"
  - **Onsite**: specific city names from cities array
- Scoring:
  - **+1.0**: Perfect match (e.g., remote job + remote preference)
  - **+0.5**: Acceptable match (e.g., hybrid when prefer remote)
  - **-0.5**: Slight mismatch (e.g., hybrid when prefer onsite)
  - **-2.0**: Hard mismatch (dealbreaker, e.g., onsite in wrong city)

---

### Phase 4: Explanation Generation

Generate human-readable reasons for the score.

**Format**:
```typescript
reasons: [
  "✓ Strong match: Kafka, Distributed Systems, Python",
  "✓ Role match: Backend Engineering",
  "✓ Location: Remote OK",
  "⚠ Missing: Kubernetes experience"
]
```

**Logic**:
- List top 3 matched keywords/stacks
- Mention role match/mismatch
- Mention location compatibility
- Highlight 1 red flag (missing critical skill, location issue, etc.)
- Limit to 3-5 reasons for brevity

---

### Phase 5: Background Worker Integration

**File**: `src/background/index.ts` (modify existing)

**Tasks**:
1. Add COMPUTE_SCORE message handler
2. Load settings from storage
3. Call scoreJob() with job and settings
4. Return score and reasons to content script
5. Handle errors gracefully (fallback to neutral score)

**Message flow**:
```
Content Script → Background Worker: COMPUTE_SCORE { job }
Background Worker:
  1. Load settings from SettingsStorage
  2. Call scoreJob(job, settings)
  3. Return { score, reasons }
Content Script ← Background Worker: COMPUTE_SCORE_RESPONSE { score, reasons }
```

---

## Testing Strategy

### Unit Tests

**File**: `src/background/scorer.test.ts`

**Test cases**:
1. **Keyword extraction**:
   - Extract tech keywords from text
   - Filter stop words
   - Handle empty text

2. **Keyword scoring**:
   - Score 100% match (all keywords present)
   - Score 50% match (half keywords present)
   - Score 0% match (no keywords present)
   - Boost preferred stacks

3. **Role scoring**:
   - Strong match (Backend + Backend preference)
   - Mismatch (Frontend + Backend preference)
   - Neutral (unclear role)

4. **Location scoring**:
   - Remote match
   - Hybrid match
   - Onsite match with city
   - Hard mismatch (onsite in wrong city)

5. **Overall scoring**:
   - Perfect job (high keyword, role, location match)
   - Poor fit (low keyword, role mismatch)
   - Mixed signals (high keyword, location mismatch)

6. **Explanation generation**:
   - Verify top matches listed
   - Verify red flags included
   - Verify reason count (3-5)

### Integration Tests

**File**: `src/background/scorer.integration.test.ts`

**Test cases**:
1. Score real job example (use fixtures from extractor tests)
2. Load settings from storage and score
3. Handle missing settings gracefully
4. Score batch of 10+ jobs (performance check)

---

## Performance Targets

- **Scoring time**: <100ms per job (as per technical overview)
- **Memory**: Minimal (no large embeddings in Phase 1)
- **Batch processing**: Handle 100+ jobs without blocking UI

**Optimization notes**:
- Cache keyword extraction for resume (compute once per session)
- Use Set for O(1) keyword lookups
- Avoid regex in tight loops

---

## API Design

### Public API (exported from scorer.ts)

```typescript
/**
 * Score a job based on user preferences
 * @param job - Job to score (must include description)
 * @param settings - User settings (resume, preferences, weights)
 * @returns Scoring result with score, reasons, and breakdown
 */
export async function scoreJob(
  job: Partial<Job>,
  settings: Settings
): Promise<ScoringResult>;

/**
 * Extract keywords from text
 * @param text - Text to extract keywords from
 * @returns Array of normalized keywords
 */
export function extractKeywords(text: string): string[];

/**
 * Batch score multiple jobs
 * @param jobs - Jobs to score
 * @param settings - User settings
 * @returns Array of scoring results
 */
export async function scoreJobs(
  jobs: Partial<Job>[],
  settings: Settings
): Promise<ScoringResult[]>;
```

---

## Deliverables Checklist

- [ ] `src/background/scorer.ts` - Core scoring module
  - [ ] extractKeywords() function
  - [ ] computeKeywordScore() function
  - [ ] computeRoleScore() function
  - [ ] computeLocationScore() function
  - [ ] generateReasons() function
  - [ ] scoreJob() public API
  - [ ] scoreJobs() batch API

- [ ] `src/background/scorer.test.ts` - Unit tests
  - [ ] Keyword extraction tests (5+ cases)
  - [ ] Keyword scoring tests (5+ cases)
  - [ ] Role scoring tests (3+ cases)
  - [ ] Location scoring tests (4+ cases)
  - [ ] Overall scoring tests (5+ cases)
  - [ ] Explanation tests (3+ cases)

- [ ] `src/background/index.ts` - Message handler integration
  - [ ] Add COMPUTE_SCORE handler
  - [ ] Load settings from storage
  - [ ] Call scoreJob() and return result
  - [ ] Error handling

- [ ] `src/background/index.test.ts` - Integration tests
  - [ ] End-to-end scoring with storage
  - [ ] Batch scoring performance test
  - [ ] Error handling test

---

## Success Metrics

### Functional
- ✅ Scores returned for all jobs with descriptions
- ✅ Scores in 0-10 range
- ✅ Explanations include 3-5 reasons
- ✅ Top matches and red flags present

### Performance
- ✅ <100ms scoring time per job
- ✅ Handles 100+ jobs without errors
- ✅ No UI blocking

### Quality
- ✅ ≥70% relevance accuracy (manual spot check)
- ✅ >90% test coverage for scorer.ts
- ✅ All edge cases handled (missing data, empty text, etc.)

---

## Future Work (Phase 2+)

These features are **out of scope** for this issue:

- ❌ Embeddings / semantic similarity (Phase 2)
- ❌ Scoring weights UI (job-triage-16)
- ❌ Profile management (job-triage-17)
- ❌ Machine learning / model training
- ❌ Cloud-based scoring

---

## Notes for Implementation

### Quick Start

1. **Start with tests**: Write tests first (TDD approach)
   ```bash
   # Create test file with failing tests
   touch src/background/scorer.test.ts
   pnpm test src/background/scorer.test.ts --watch
   ```

2. **Implement incrementally**:
   - Phase 1: extractKeywords() + tests
   - Phase 2: computeKeywordScore() + tests
   - Phase 3: computeRoleScore() + tests
   - Phase 4: computeLocationScore() + tests
   - Phase 5: scoreJob() integration + tests
   - Phase 6: Background worker integration

3. **Use fixtures**:
   - Reuse job description fixtures from extractor tests
   - Create sample Settings objects for tests

4. **Iterate on keyword taxonomy**:
   - Start with ~50 common tech keywords
   - Expand based on real job descriptions
   - Consider user feedback for missing terms

### Common Pitfalls

- **Don't over-engineer**: Keep it simple for MVP
- **No ML for Phase 1**: Pure heuristics only
- **Cache resume keywords**: Extract once per session
- **Handle missing data**: Not all jobs have location/role info
- **Normalize text**: Lowercase everything for matching

### Debugging Tips

- Log scoring breakdown for each component
- Add debug mode to dump matched keywords
- Test against real job postings from target ATS sites
- Compare scores manually for sanity check

---

## Questions to Resolve

1. **Keyword taxonomy size**: Start with 50 or 200 terms?
   - **Recommendation**: Start with ~100 high-value terms, expand iteratively

2. **Location hard filters**: Should we exclude jobs with wrong location?
   - **Recommendation**: Yes, apply -2.0 penalty (near-zero score) for dealbreakers

3. **Resume keyword caching**: Cache in memory or storage?
   - **Recommendation**: In-memory for session, no need for persistence

4. **Batch scoring**: Process all jobs at once or stream?
   - **Recommendation**: Batch of 10-20 at a time to provide progressive UI updates

---

## Summary

This plan breaks down job-triage-6 into 5 phases:
1. Core module setup
2. Keyword extraction & matching
3. Role & location matching
4. Explanation generation
5. Background worker integration

**Estimated effort**: 6-8 hours for full implementation + tests

**Unblocks**: job-triage-10 (Job list renderer) once complete

**Next steps after completion**:
- Test with real job listings
- Tune keyword taxonomy based on results
- Prepare for Phase 2 embeddings (job-triage-TBD)
