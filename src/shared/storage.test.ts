/**
 * Tests for IndexedDB storage layer
 */

import { describe, it, expect } from 'vitest';
import { initDatabase, JobStorage, SettingsStorage, ProfileStorage, EmbeddingStorage } from './storage';
import { createMockJob, createMockSettings, createMockProfile, createMockEmbedding } from '@/__tests__/mocks';

describe('initDatabase', () => {
  it('should create database with correct object stores', async () => {
    const db = await initDatabase();

    expect(db.name).toBe('JobTriageDB');
    expect(db.objectStoreNames.contains('jobs')).toBe(true);
    expect(db.objectStoreNames.contains('settings')).toBe(true);
    expect(db.objectStoreNames.contains('profiles')).toBe(true);
    expect(db.objectStoreNames.contains('embeddings')).toBe(true);

    db.close();
  });

  it('should create indexes on jobs store', async () => {
    const db = await initDatabase();
    const transaction = db.transaction('jobs', 'readonly');
    const store = transaction.objectStore('jobs');

    expect(store.indexNames.contains('url')).toBe(true);
    expect(store.indexNames.contains('firstSeen')).toBe(true);
    expect(store.indexNames.contains('score')).toBe(true);

    db.close();
  });
});

describe('JobStorage', () => {
  describe('save and get', () => {
    it('should save and retrieve a job successfully', async () => {
      const job = createMockJob({ id: 'test-job-1', url: 'test-job-1' });
      await JobStorage.save(job);

      const retrieved = await JobStorage.get(job.id);
      expect(retrieved?.id).toBe(job.id);
      expect(retrieved?.title).toBe(job.title);
    });

    it('should return null for non-existent job', async () => {
      const result = await JobStorage.get('non-existent-id-xyz');
      expect(result).toBeNull();
    });

    it('should update existing job', async () => {
      const job = createMockJob({ id: 'test-job-2', url: 'test-job-2' });
      await JobStorage.save(job);

      const updated = { ...job, score: 9.5, notes: 'Updated notes' };
      await JobStorage.save(updated);

      const retrieved = await JobStorage.get(job.id);
      expect(retrieved?.score).toBe(9.5);
      expect(retrieved?.notes).toBe('Updated notes');
    });
  });

  describe('getAll', () => {
    it('should retrieve saved jobs', async () => {
      const job1 = createMockJob({ id: 'list-job-1', url: 'list-job-1' });
      const job2 = createMockJob({ id: 'list-job-2', url: 'list-job-2' });

      await JobStorage.save(job1);
      await JobStorage.save(job2);

      const jobs = await JobStorage.getAll();
      const ids = jobs.map((j) => j.id);

      expect(ids).toContain('list-job-1');
      expect(ids).toContain('list-job-2');
    });
  });
});

describe('SettingsStorage', () => {
  it('should save and retrieve settings', async () => {
    const settings = createMockSettings({
      preferredStacks: ['Go', 'Rust', 'PostgreSQL'],
    });
    await SettingsStorage.save(settings);

    const retrieved = await SettingsStorage.get();
    expect(retrieved?.preferredStacks).toEqual(['Go', 'Rust', 'PostgreSQL']);
  });

  it('should update existing settings', async () => {
    const settings = createMockSettings();
    await SettingsStorage.save(settings);

    const updated = createMockSettings({
      resume: 'Updated resume text',
      scoreThreshold: 8.0,
    });
    await SettingsStorage.save(updated);

    const retrieved = await SettingsStorage.get();
    expect(retrieved?.resume).toBe('Updated resume text');
    expect(retrieved?.scoreThreshold).toBe(8.0);
  });
});

describe('ProfileStorage', () => {
  it('should save and retrieve profile', async () => {
    const profile = createMockProfile({ id: 'profile-test-1', name: 'Test Profile' });
    await ProfileStorage.save(profile);

    const retrieved = await ProfileStorage.get('profile-test-1');
    expect(retrieved?.name).toBe('Test Profile');
  });

  it('should return null for non-existent profile', async () => {
    const result = await ProfileStorage.get('non-existent-profile');
    expect(result).toBeNull();
  });

  it('should retrieve multiple profiles', async () => {
    const profile1 = createMockProfile({ id: 'p-list-1', name: 'Profile 1' });
    const profile2 = createMockProfile({ id: 'p-list-2', name: 'Profile 2' });

    await ProfileStorage.save(profile1);
    await ProfileStorage.save(profile2);

    const profiles = await ProfileStorage.getAll();
    const names = profiles.map((p) => p.name);

    expect(names).toContain('Profile 1');
    expect(names).toContain('Profile 2');
  });
});

describe('EmbeddingStorage', () => {
  it('should save and retrieve embedding', async () => {
    const embedding = createMockEmbedding({ hash: 'unique-hash-123' });
    await EmbeddingStorage.save(embedding);

    const retrieved = await EmbeddingStorage.get('unique-hash-123');
    expect(retrieved?.hash).toBe('unique-hash-123');
    expect(retrieved?.vector).toHaveLength(384);
  });

  it('should return null for non-existent hash', async () => {
    const result = await EmbeddingStorage.get('non-existent-hash');
    expect(result).toBeNull();
  });

  it('should delete embedding', async () => {
    const embedding = createMockEmbedding({ hash: 'delete-test' });
    await EmbeddingStorage.save(embedding);
    await EmbeddingStorage.delete('delete-test');

    const retrieved = await EmbeddingStorage.get('delete-test');
    expect(retrieved).toBeNull();
  });

  it('should delete embeddings older than timestamp', async () => {
    const now = Date.now();
    const old = createMockEmbedding({ hash: 'old-emb', createdAt: now - 10000 });
    const recent = createMockEmbedding({ hash: 'recent-emb', createdAt: now });

    await EmbeddingStorage.save(old);
    await EmbeddingStorage.save(recent);

    await EmbeddingStorage.deleteOlderThan(now - 5000);

    const oldRetrieved = await EmbeddingStorage.get('old-emb');
    const recentRetrieved = await EmbeddingStorage.get('recent-emb');

    expect(oldRetrieved).toBeNull();
    expect(recentRetrieved).not.toBeNull();
  });
});

describe('JobStorage - Delete operations', () => {
  it('should delete a job', async () => {
    const job = createMockJob({ id: 'delete-job-1', url: 'delete-job-1' });
    await JobStorage.save(job);
    await JobStorage.delete('delete-job-1');

    const retrieved = await JobStorage.get('delete-job-1');
    expect(retrieved).toBeNull();
  });

  it('should delete multiple jobs', async () => {
    const jobs = [
      createMockJob({ id: 'multi-del-1', url: 'multi-del-1' }),
      createMockJob({ id: 'multi-del-2', url: 'multi-del-2' }),
      createMockJob({ id: 'multi-del-3', url: 'multi-del-3' }),
    ];

    for (const job of jobs) {
      await JobStorage.save(job);
    }

    await JobStorage.deleteMany(['multi-del-1', 'multi-del-3']);

    const job1 = await JobStorage.get('multi-del-1');
    const job2 = await JobStorage.get('multi-del-2');
    const job3 = await JobStorage.get('multi-del-3');

    expect(job1).toBeNull();
    expect(job2).not.toBeNull();
    expect(job3).toBeNull();
  });

  it('should handle empty array in deleteMany', async () => {
    await expect(JobStorage.deleteMany([])).resolves.not.toThrow();
  });

  it('should clear all jobs', async () => {
    const jobs = [
      createMockJob({ id: 'clear-1', url: 'clear-1' }),
      createMockJob({ id: 'clear-2', url: 'clear-2' }),
    ];

    for (const job of jobs) {
      await JobStorage.save(job);
    }

    await JobStorage.clear();

    const job1 = await JobStorage.get('clear-1');
    const job2 = await JobStorage.get('clear-2');

    expect(job1).toBeNull();
    expect(job2).toBeNull();
  });
});

describe('JobStorage - Query operations', () => {
  it('should get jobs by decision (thumbs_up)', async () => {
    const approved = createMockJob({ id: 'approved-1', url: 'approved-1', decision: 'thumbs_up' });
    const rejected = createMockJob({ id: 'rejected-1', url: 'rejected-1', decision: 'thumbs_down' });
    const undecided = createMockJob({ id: 'undecided-1', url: 'undecided-1' });

    await JobStorage.save(approved);
    await JobStorage.save(rejected);
    await JobStorage.save(undecided);

    const thumbsUp = await JobStorage.getByDecision('thumbs_up');
    const ids = thumbsUp.map((j) => j.id);

    expect(ids).toContain('approved-1');
    expect(ids).not.toContain('rejected-1');
    expect(ids).not.toContain('undecided-1');
  });

  it('should get jobs by score range', async () => {
    const high = createMockJob({ id: 'high-score', url: 'high-score', score: 9.5 });
    const medium = createMockJob({ id: 'med-score', url: 'med-score', score: 7.0 });
    const low = createMockJob({ id: 'low-score', url: 'low-score', score: 3.0 });

    await JobStorage.save(high);
    await JobStorage.save(medium);
    await JobStorage.save(low);

    const results = await JobStorage.getByScoreRange(6.0, 10.0);
    const ids = results.map((j) => j.id);

    expect(ids).toContain('high-score');
    expect(ids).toContain('med-score');
    expect(ids).not.toContain('low-score');
  });

  it('should get jobs by tag', async () => {
    const tagged = createMockJob({ id: 'tagged-1', url: 'tagged-1', tags: ['urgent', 'remote'] });
    const untagged = createMockJob({ id: 'untagged-1', url: 'untagged-1' });

    await JobStorage.save(tagged);
    await JobStorage.save(untagged);

    const urgent = await JobStorage.getByTag('urgent');
    const ids = urgent.map((j) => j.id);

    expect(ids).toContain('tagged-1');
    expect(ids).not.toContain('untagged-1');
  });

  it('should get recent jobs with limit', async () => {
    await JobStorage.clear(); // Clear DB for test isolation

    const now = Date.now();
    const jobs = [
      createMockJob({ id: 'recent-1', url: 'recent-1', firstSeen: now - 1000 }),
      createMockJob({ id: 'recent-2', url: 'recent-2', firstSeen: now - 2000 }),
      createMockJob({ id: 'recent-3', url: 'recent-3', firstSeen: now - 3000 }),
    ];

    for (const job of jobs) {
      await JobStorage.save(job);
    }

    const results = await JobStorage.getRecent(2);

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('recent-1');
    expect(results[1].id).toBe('recent-2');
  });

  it('should check if job exists by URL', async () => {
    const job = createMockJob({ id: 'exists-test', url: 'https://example.com/job/exists' });
    await JobStorage.save(job);

    const exists = await JobStorage.exists('https://example.com/job/exists');
    const notExists = await JobStorage.exists('https://example.com/job/nope');

    expect(exists).toBe(true);
    expect(notExists).toBe(false);
  });

  it('should get jobs by date range', async () => {
    const now = Date.now();
    const today = createMockJob({ id: 'today', url: 'today', firstSeen: now });
    const yesterday = createMockJob({ id: 'yesterday', url: 'yesterday', firstSeen: now - 86400000 });
    const lastWeek = createMockJob({ id: 'lastweek', url: 'lastweek', firstSeen: now - 604800000 });

    await JobStorage.save(today);
    await JobStorage.save(yesterday);
    await JobStorage.save(lastWeek);

    const recent = await JobStorage.getByDateRange(now - 172800000, now); // Last 2 days
    const ids = recent.map((j) => j.id);

    expect(ids).toContain('today');
    expect(ids).toContain('yesterday');
    expect(ids).not.toContain('lastweek');
  });
});

describe('JobStorage - Bulk operations', () => {
  it('should save many jobs in one transaction', async () => {
    const jobs = Array.from({ length: 10 }, (_, i) =>
      createMockJob({ id: `bulk-${i}`, url: `bulk-${i}` })
    );

    await JobStorage.saveMany(jobs);

    const job0 = await JobStorage.get('bulk-0');
    const job9 = await JobStorage.get('bulk-9');

    expect(job0).not.toBeNull();
    expect(job9).not.toBeNull();
  });

  it('should handle empty array in saveMany', async () => {
    await expect(JobStorage.saveMany([])).resolves.not.toThrow();
  });
});

describe('JobStorage - Count operations', () => {
  it('should count all jobs', async () => {
    await JobStorage.clear();

    const jobs = [
      createMockJob({ id: 'count-1', url: 'count-1' }),
      createMockJob({ id: 'count-2', url: 'count-2' }),
      createMockJob({ id: 'count-3', url: 'count-3' }),
    ];

    await JobStorage.saveMany(jobs);

    const total = await JobStorage.count();
    expect(total).toBe(3);
  });

  it('should count jobs by decision', async () => {
    await JobStorage.clear();

    const jobs = [
      createMockJob({ id: 'count-up-1', url: 'count-up-1', decision: 'thumbs_up' }),
      createMockJob({ id: 'count-up-2', url: 'count-up-2', decision: 'thumbs_up' }),
      createMockJob({ id: 'count-down-1', url: 'count-down-1', decision: 'thumbs_down' }),
    ];

    await JobStorage.saveMany(jobs);

    const upCount = await JobStorage.countByDecision('thumbs_up');
    const downCount = await JobStorage.countByDecision('thumbs_down');

    expect(upCount).toBe(2);
    expect(downCount).toBe(1);
  });

  it('should count jobs by score range', async () => {
    await JobStorage.clear();

    const jobs = [
      createMockJob({ id: 'score-count-1', url: 'score-count-1', score: 8.5 }),
      createMockJob({ id: 'score-count-2', url: 'score-count-2', score: 7.0 }),
      createMockJob({ id: 'score-count-3', url: 'score-count-3', score: 5.0 }),
    ];

    await JobStorage.saveMany(jobs);

    const highScoreCount = await JobStorage.countByScoreRange(7.0, 10.0);
    expect(highScoreCount).toBe(2);
  });
});

describe('JobStorage - Cache cleanup', () => {
  it('should delete jobs older than N days', async () => {
    const now = Date.now();
    const old = createMockJob({
      id: 'old-job',
      url: 'old-job',
      lastUpdated: now - 31 * 24 * 60 * 60 * 1000,
    });
    const recent = createMockJob({ id: 'recent-job', url: 'recent-job', lastUpdated: now });

    await JobStorage.save(old);
    await JobStorage.save(recent);

    await JobStorage.deleteOlderThan(30); // Delete older than 30 days

    const oldRetrieved = await JobStorage.get('old-job');
    const recentRetrieved = await JobStorage.get('recent-job');

    expect(oldRetrieved).toBeNull();
    expect(recentRetrieved).not.toBeNull();
  });

  it('should prune jobs keeping only top N by score', async () => {
    await JobStorage.clear();

    const jobs = [
      createMockJob({ id: 'prune-1', url: 'prune-1', score: 9.0 }),
      createMockJob({ id: 'prune-2', url: 'prune-2', score: 8.0 }),
      createMockJob({ id: 'prune-3', url: 'prune-3', score: 7.0 }),
      createMockJob({ id: 'prune-4', url: 'prune-4', score: 6.0 }),
    ];

    await JobStorage.saveMany(jobs);
    await JobStorage.pruneByScore(2); // Keep only top 2

    const job1 = await JobStorage.get('prune-1');
    const job2 = await JobStorage.get('prune-2');
    const job3 = await JobStorage.get('prune-3');
    const job4 = await JobStorage.get('prune-4');

    expect(job1).not.toBeNull();
    expect(job2).not.toBeNull();
    expect(job3).toBeNull();
    expect(job4).toBeNull();
  });

  it('should delete decided jobs older than N days', async () => {
    const now = Date.now();
    const oldDecided = createMockJob({
      id: 'old-decided',
      url: 'old-decided',
      decision: 'thumbs_up',
      lastUpdated: now - 31 * 24 * 60 * 60 * 1000,
    });
    const recentDecided = createMockJob({
      id: 'recent-decided',
      url: 'recent-decided',
      decision: 'thumbs_up',
      lastUpdated: now,
    });
    const undecided = createMockJob({
      id: 'undecided',
      url: 'undecided',
      lastUpdated: now - 31 * 24 * 60 * 60 * 1000,
    });

    await JobStorage.save(oldDecided);
    await JobStorage.save(recentDecided);
    await JobStorage.save(undecided);

    await JobStorage.deleteDecided(30); // Delete decided jobs older than 30 days

    const oldRetrieved = await JobStorage.get('old-decided');
    const recentRetrieved = await JobStorage.get('recent-decided');
    const undecidedRetrieved = await JobStorage.get('undecided');

    expect(oldRetrieved).toBeNull();
    expect(recentRetrieved).not.toBeNull();
    expect(undecidedRetrieved).not.toBeNull(); // Undecided jobs are kept
  });
});

describe('ProfileStorage - Delete operations', () => {
  it('should delete a profile', async () => {
    const profile = createMockProfile({ id: 'delete-profile', name: 'To Delete' });
    await ProfileStorage.save(profile);
    await ProfileStorage.delete('delete-profile');

    const retrieved = await ProfileStorage.get('delete-profile');
    expect(retrieved).toBeNull();
  });

  it('should count profiles', async () => {
    const count1 = await ProfileStorage.count();
    const profile = createMockProfile({ id: 'count-profile', name: 'Count Test' });
    await ProfileStorage.save(profile);
    const count2 = await ProfileStorage.count();

    expect(count2).toBeGreaterThan(count1);
  });
});

describe('Storage - Schema migration', () => {
  it('should have v2 schema with new indexes', async () => {
    const db = await initDatabase();
    const transaction = db.transaction('jobs', 'readonly');
    const store = transaction.objectStore('jobs');

    // Check that v2 indexes exist
    expect(store.indexNames.contains('decision')).toBe(true);
    expect(store.indexNames.contains('tags')).toBe(true);
    expect(store.indexNames.contains('lastUpdated')).toBe(true);

    db.close();
  });
});
