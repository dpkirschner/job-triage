# Storage API Documentation

## Overview

The Job Triage storage layer provides a type-safe, IndexedDB-based persistence system with support for:
- **Jobs**: Job postings with scores, decisions, and tags
- **Settings**: User preferences and resume
- **Profiles**: Saved configurations for different job searches
- **Embeddings**: Cached text embeddings for semantic similarity

**Version**: 2 (includes decision, tags, and lastUpdated indexes)

---

## JobStorage

### Basic CRUD

#### `get(id: string): Promise<Job | null>`
Retrieve a single job by ID.

```typescript
const job = await JobStorage.get('job-123');
if (job) {
  console.log(job.title, job.score);
}
```

#### `save(job: Job): Promise<void>`
Save or update a job.

```typescript
await JobStorage.save({
  id: 'job-123',
  url: 'https://example.com/job/123',
  title: 'Software Engineer',
  description: 'Build amazing products...',
  score: 8.5,
  decision: 'thumbs_up',
  firstSeen: Date.now(),
  lastUpdated: Date.now(),
});
```

#### `getAll(): Promise<Job[]>`
Retrieve all jobs.

```typescript
const allJobs = await JobStorage.getAll();
console.log(`Total jobs: ${allJobs.length}`);
```

---

### Bulk Operations

#### `saveMany(jobs: Job[]): Promise<void>`
Save multiple jobs in a single transaction (efficient for 100+ jobs).

```typescript
const jobs = Array.from({ length: 100 }, (_, i) => ({
  id: `job-${i}`,
  url: `https://example.com/job/${i}`,
  title: `Job ${i}`,
  description: '...',
  firstSeen: Date.now(),
  lastUpdated: Date.now(),
}));

await JobStorage.saveMany(jobs);
```

**Performance**: <50ms for 100 jobs

---

### Delete Operations

#### `delete(id: string): Promise<void>`
Delete a single job.

```typescript
await JobStorage.delete('job-123');
```

#### `deleteMany(ids: string[]): Promise<void>`
Delete multiple jobs in a single transaction.

```typescript
await JobStorage.deleteMany(['job-1', 'job-2', 'job-3']);
```

#### `clear(): Promise<void>`
Delete all jobs.

```typescript
await JobStorage.clear();
```

---

### Query Operations

#### `getByDecision(decision: 'thumbs_up' | 'thumbs_down'): Promise<Job[]>`
Get all jobs with a specific decision (uses index for efficiency).

```typescript
// Get all approved jobs for "Open all 👍" feature
const approved = await JobStorage.getByDecision('thumbs_up');
for (const job of approved) {
  window.open(job.url, '_blank');
}
```

#### `getByScoreRange(min: number, max: number): Promise<Job[]>`
Get jobs within a score range (uses index).

```typescript
// Get high-scoring jobs (≥7.0)
const highScoring = await JobStorage.getByScoreRange(7.0, 10.0);
```

#### `getByTag(tag: string): Promise<Job[]>`
Get jobs with a specific tag (uses multi-entry index).

```typescript
// Get all jobs tagged "urgent"
const urgent = await JobStorage.getByTag('urgent');
```

#### `getRecent(limit: number, offset?: number): Promise<Job[]>`
Get most recent jobs with pagination support.

```typescript
// Get 10 most recent jobs
const recent = await JobStorage.getRecent(10);

// Pagination: skip first 10, get next 10
const page2 = await JobStorage.getRecent(10, 10);
```

#### `getByDateRange(start: number, end: number): Promise<Job[]>`
Get jobs within a date range.

```typescript
const now = Date.now();
const yesterday = now - 86400000;

// Get jobs from last 24 hours
const todaysJobs = await JobStorage.getByDateRange(yesterday, now);
```

#### `exists(url: string): Promise<boolean>`
Check if a job exists by URL (for deduplication).

```typescript
const url = 'https://example.com/job/123';
if (await JobStorage.exists(url)) {
  console.log('Already seen this job');
} else {
  // Fetch and save new job
}
```

---

### Count Operations

#### `count(): Promise<number>`
Count all jobs.

```typescript
const total = await JobStorage.count();
console.log(`You've triaged ${total} jobs`);
```

#### `countByDecision(decision: 'thumbs_up' | 'thumbs_down'): Promise<number>`
Count jobs by decision.

```typescript
const approved = await JobStorage.countByDecision('thumbs_up');
const rejected = await JobStorage.countByDecision('thumbs_down');
console.log(`👍 ${approved} | 👎 ${rejected}`);
```

#### `countByScoreRange(min: number, max: number): Promise<number>`
Count jobs within a score range.

```typescript
const highScoring = await JobStorage.countByScoreRange(7.0, 10.0);
console.log(`${highScoring} jobs score ≥7.0`);
```

---

### Cache Cleanup

#### `deleteOlderThan(days: number): Promise<void>`
Delete jobs older than N days (uses lastUpdated).

```typescript
// Clean up jobs older than 30 days
await JobStorage.deleteOlderThan(30);
```

#### `pruneByScore(keepTopN: number): Promise<void>`
Keep only the top N highest-scoring jobs, delete the rest.

```typescript
// Keep only top 100 jobs by score
await JobStorage.pruneByScore(100);
```

#### `deleteDecided(olderThanDays: number): Promise<void>`
Delete decided jobs (thumbs up/down) older than N days.

```typescript
// Clean up decided jobs older than 7 days
await JobStorage.deleteDecided(7);
```

---

## SettingsStorage

### `get(): Promise<Settings | null>`
Get user settings.

```typescript
const settings = await SettingsStorage.get();
if (settings) {
  console.log('Resume:', settings.resume);
  console.log('Preferred stacks:', settings.preferredStacks);
}
```

### `save(settings: Settings): Promise<void>`
Save user settings.

```typescript
await SettingsStorage.save({
  resume: 'Software Engineer with 5 years...',
  preferredStacks: ['Python', 'React', 'PostgreSQL'],
  preferredRoles: ['Backend Engineer', 'Full Stack'],
  locationPreferences: {
    remote: true,
    hybrid: true,
    onsite: false,
  },
  scoringWeights: {
    similarity: 0.6,
    keyword: 0.2,
    role: 0.1,
    location: 0.1,
  },
  scoreThreshold: 6.0,
});
```

---

## ProfileStorage

### `get(id: string): Promise<Profile | null>`
Get a saved profile.

```typescript
const profile = await ProfileStorage.get('backend-jobs');
```

### `save(profile: Profile): Promise<void>`
Save a profile.

```typescript
await ProfileStorage.save({
  id: 'backend-jobs',
  name: 'Backend Engineer Search',
  settings: {
    preferredStacks: ['Go', 'Python', 'PostgreSQL'],
    preferredRoles: ['Backend Engineer', 'Staff Engineer'],
  },
  createdAt: Date.now(),
});
```

### `getAll(): Promise<Profile[]>`
Get all profiles.

```typescript
const profiles = await ProfileStorage.getAll();
console.log('Saved profiles:', profiles.map(p => p.name));
```

### `delete(id: string): Promise<void>`
Delete a profile.

```typescript
await ProfileStorage.delete('backend-jobs');
```

### `count(): Promise<number>`
Count profiles.

```typescript
const count = await ProfileStorage.count();
console.log(`${count} saved profiles`);
```

---

## EmbeddingStorage

### `get(hash: string): Promise<Embedding | null>`
Get a cached embedding by hash.

```typescript
const hash = 'abc123...';
const embedding = await EmbeddingStorage.get(hash);
if (embedding) {
  console.log('Cache hit! Vector length:', embedding.vector.length);
}
```

### `save(embedding: Embedding): Promise<void>`
Save an embedding.

```typescript
await EmbeddingStorage.save({
  hash: 'abc123...',
  vector: [0.1, 0.2, ...], // 384-dim vector
  modelVersion: 'minilm-v2',
  createdAt: Date.now(),
});
```

### `delete(hash: string): Promise<void>`
Delete an embedding.

```typescript
await EmbeddingStorage.delete('abc123...');
```

### `deleteOlderThan(timestamp: number): Promise<void>`
Delete embeddings older than a timestamp.

```typescript
const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
await EmbeddingStorage.deleteOlderThan(thirtyDaysAgo);
```

### `count(): Promise<number>`
Count cached embeddings.

```typescript
const count = await EmbeddingStorage.count();
console.log(`${count} cached embeddings`);
```

---

## Schema & Migrations

### Current Schema (v2)

**Jobs Store**
- Keypath: `id`
- Indexes: `url` (unique), `firstSeen`, `score`, `decision`, `tags` (multi-entry), `lastUpdated`

**Settings Store**
- Keypath: `id` (always 'default')

**Profiles Store**
- Keypath: `id`

**Embeddings Store**
- Keypath: `hash`
- Indexes: `createdAt`

### Migration History

**v1**: Initial schema with basic indexes
**v2**: Added `decision`, `tags`, `lastUpdated` indexes to Jobs store

Migrations run automatically on database open. Users upgrading from v1 will see new indexes created without data loss.

---

## Performance Guidelines

1. **Bulk operations**: Use `saveMany()` for 10+ jobs (single transaction is ~10x faster)
2. **Queries**: All query methods use indexes for O(log n) lookups
3. **Pagination**: Use `getRecent(limit, offset)` for large result sets
4. **Cleanup**: Run cache cleanup regularly to prevent unbounded growth

**Benchmarks** (100 jobs):
- `saveMany()`: <50ms
- `getByDecision()`: <20ms
- `getByScoreRange()`: <20ms
- `deleteMany()`: <30ms

---

## Example Workflows

### Triage Session
```typescript
// 1. Fetch jobs from page
const jobUrls = extractJobUrlsFromPage();

// 2. Check for duplicates
const newUrls = [];
for (const url of jobUrls) {
  if (!await JobStorage.exists(url)) {
    newUrls.push(url);
  }
}

// 3. Fetch and score jobs
const jobs = await Promise.all(newUrls.map(fetchAndScoreJob));

// 4. Save in bulk
await JobStorage.saveMany(jobs);

// 5. Display high-scoring jobs
const highScoring = await JobStorage.getByScoreRange(7.0, 10.0);
displayJobsInOverlay(highScoring);
```

### "Open all 👍" Feature
```typescript
const approved = await JobStorage.getByDecision('thumbs_up');
for (const job of approved) {
  window.open(job.url, '_blank');
}
```

### Cache Maintenance
```typescript
// Clean up old jobs (run daily)
await JobStorage.deleteOlderThan(30); // Delete >30 days old
await JobStorage.deleteDecided(7);    // Delete decided jobs >7 days old
await JobStorage.pruneByScore(200);   // Keep only top 200 jobs

// Clean up old embeddings
const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
await EmbeddingStorage.deleteOlderThan(thirtyDaysAgo);
```

---

## Error Handling

All storage operations return Promises that reject on error:

```typescript
try {
  await JobStorage.save(job);
} catch (error) {
  console.error('Failed to save job:', error);
  // Handle error (e.g., show user notification)
}
```

Common errors:
- `QuotaExceededError`: Storage quota exceeded (run cleanup)
- `InvalidStateError`: Database closed unexpectedly
- `ConstraintError`: Unique constraint violation (e.g., duplicate URL)

---

## Testing

The storage layer has 36 comprehensive tests covering:
- CRUD operations
- Bulk operations
- Query operations (decision, score, tags, date range)
- Count operations
- Cache cleanup
- Schema migrations
- Edge cases (empty arrays, missing data, etc.)

Run tests:
```bash
pnpm test storage
```

All operations are tested with realistic data and edge cases to ensure reliability.
