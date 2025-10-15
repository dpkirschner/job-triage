# job-triage-7: IndexedDB Storage Layer Enhancement

## Current State

The storage layer has a **basic foundation**:
- ✅ Schema defined for 4 stores: `jobs`, `settings`, `profiles`, `embeddings`
- ✅ Basic indexes: `url`, `firstSeen`, `score` on jobs store
- ✅ CRUD operations: `get()`, `save()`, `getAll()`
- ✅ Basic test coverage (13 tests)

## Missing Features (Blockers)

The current implementation is insufficient for the full product because:

1. **No delete operations** → Can't clean up old jobs or remove profiles
2. **No query/filtering** → Can't filter by decision, score range, or tags
3. **No bulk operations** → Inefficient for 100+ listings (perf requirement)
4. **No decision index** → Can't efficiently query thumbs up/down jobs
5. **No cache cleanup** → Database will grow unbounded
6. **No migration system** → Can't evolve schema as features are added
7. **No count operations** → Can't show metrics in UI ("X jobs triaged")

## Requirements from Product Spec

### Performance Targets
- Handle **100+ listings** without crash → need bulk ops
- **<100ms scoring** per job → efficient queries needed
- **Decisions persist** across reloads → robust decision tracking

### Feature Dependencies
- **job-triage-6** (scoring) needs: query by score range, bulk save scores
- **job-triage-8** (settings) needs: settings CRUD, profiles CRUD
- **job-triage-11** (decisions) needs: decision index, query by decision
- **job-triage-15** (deduplication) needs: exists check, cache cleanup

## Implementation Plan

### 1. Schema Enhancements

**Add indexes to jobs store:**
```typescript
jobStore.createIndex('decision', 'decision', { unique: false });
jobStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });
jobStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
```

**Add tags index** for Phase 3 features (user tagging)

**Bump DB_VERSION** to 2 and handle migration

### 2. Delete Operations

Add to all storage types:
```typescript
JobStorage.delete(id: string): Promise<void>
JobStorage.deleteMany(ids: string[]): Promise<void>
JobStorage.clear(): Promise<void>

ProfileStorage.delete(id: string): Promise<void>
EmbeddingStorage.delete(hash: string): Promise<void>
EmbeddingStorage.deleteOlderThan(timestamp: number): Promise<void>
```

### 3. Query Operations

**JobStorage queries:**
```typescript
// Filter by decision
getByDecision(decision: 'thumbs_up' | 'thumbs_down'): Promise<Job[]>

// Filter by score range
getByScoreRange(min: number, max: number): Promise<Job[]>

// Filter by tags
getByTag(tag: string): Promise<Job[]>

// Get recent jobs (pagination support)
getRecent(limit: number, offset?: number): Promise<Job[]>

// Get jobs within date range
getByDateRange(start: number, end: number): Promise<Job[]>

// Check if job exists (for deduplication)
exists(url: string): Promise<boolean>
```

### 4. Bulk Operations

For efficiency with 100+ jobs:
```typescript
JobStorage.saveMany(jobs: Job[]): Promise<void>
JobStorage.deleteMany(ids: string[]): Promise<void>
```

Use single transaction to avoid repeated DB opens

### 5. Count Operations

For UI metrics display:
```typescript
JobStorage.count(): Promise<number>
JobStorage.countByDecision(decision: string): Promise<number>
JobStorage.countByScoreRange(min: number, max: number): Promise<number>
```

### 6. Cache Cleanup Utilities

Eviction policies from tech spec:
```typescript
// Delete jobs older than N days
JobStorage.deleteOlderThan(days: number): Promise<void>

// Keep only top N jobs by score
JobStorage.pruneByScore(keepTopN: number): Promise<void>

// Clean up jobs with decisions (they've been triaged)
JobStorage.deleteDecided(olderThanDays: number): Promise<void>
```

### 7. Migration System

Support schema evolution:
```typescript
// In initDatabase onupgradeneeded
const migrations = {
  1: (db) => { /* initial schema */ },
  2: (db) => { /* add decision index */ },
  3: (db) => { /* future changes */ },
};

// Run migrations from oldVersion to newVersion
for (let v = oldVersion + 1; v <= DB_VERSION; v++) {
  migrations[v]?.(db);
}
```

### 8. Enhanced Indexes

**Decision index** (critical for filtering):
- Enables fast lookup of thumbs up/down jobs
- Required for "Open all 👍" feature

**Tags index** (multi-entry):
- Supports user tagging (Phase 3)
- Enables filtering by custom tags

## File Structure

```
src/shared/
├── storage.ts                 # Enhanced with new operations
├── storage.test.ts            # Expanded tests (40+ tests)
└── migrations.ts              # Schema migration logic (NEW)
```

## Test Coverage Goals

Expand from 13 to **40+ tests**:
- ✅ All delete operations (single, bulk, clear)
- ✅ All query operations (decision, score, tags, date)
- ✅ Bulk operations (saveMany, deleteMany)
- ✅ Count operations (total, by decision, by score)
- ✅ Cache cleanup (eviction policies)
- ✅ Migration from v1 → v2 schema
- ✅ Edge cases (empty results, invalid keys, large datasets)
- ✅ Performance tests (100+ jobs)

## API Design Principles

1. **Type safety**: All operations fully typed
2. **Error handling**: Graceful failures with meaningful errors
3. **Performance**: Single transaction for bulk ops
4. **Consistency**: Similar API across storage types
5. **Testability**: Mock-friendly, promise-based

## Implementation Checklist

- [ ] Add new indexes (decision, tags, lastUpdated)
- [ ] Implement delete operations
- [ ] Implement query operations
- [ ] Implement bulk operations
- [ ] Implement count operations
- [ ] Implement cache cleanup utilities
- [ ] Create migration system
- [ ] Write comprehensive tests (40+ tests)
- [ ] Document API and usage patterns
- [ ] Update types.ts if needed

## Success Criteria

- ✅ All storage operations <50ms for 100 jobs
- ✅ Query operations efficiently use indexes
- ✅ Migrations work seamlessly from v1 → v2
- ✅ 40+ tests passing with >90% coverage
- ✅ Unblocks job-triage-6, 8, 11, 15

## Examples

### Query by Decision
```typescript
// Get all thumbs up jobs (for "Open all 👍" feature)
const approvedJobs = await JobStorage.getByDecision('thumbs_up');
```

### Bulk Save
```typescript
// Save 100 jobs in one transaction
const jobs = await fetchAllJobsFromPage();
await JobStorage.saveMany(jobs);
```

### Cache Cleanup
```typescript
// Clean up jobs older than 30 days
await JobStorage.deleteOlderThan(30);

// Keep only top 100 jobs by score
await JobStorage.pruneByScore(100);
```

### Migration Example
```typescript
// User opens extension after update
// DB auto-migrates from v1 to v2
const db = await initDatabase(); // Runs migration
const jobs = await JobStorage.getByDecision('thumbs_up'); // Uses new index
```

## Dependencies

**Depends on:**
- ✅ job-triage-1 (project scaffold)

**Blocks:**
- ⏳ job-triage-6 (keyword scoring)
- ⏳ job-triage-8 (settings page)
- ⏳ job-triage-11 (decision controls)
- ⏳ job-triage-15 (deduplication)

## Timeline Estimate

- Schema enhancements: 30 min
- Delete operations: 1 hour
- Query operations: 2 hours
- Bulk operations: 1 hour
- Count operations: 30 min
- Cache cleanup: 1 hour
- Migration system: 1 hour
- Tests: 2 hours
- Documentation: 30 min

**Total: ~9-10 hours**
