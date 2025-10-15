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
});
