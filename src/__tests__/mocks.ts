/**
 * Mock factories for testing
 * Provides consistent test data for Jobs, Settings, Profiles, and Embeddings
 */

import type { Job, Settings, Profile, Embedding } from '@/shared/types';

/**
 * Create a mock Job object
 */
export function createMockJob(overrides?: Partial<Job>): Job {
  const now = Date.now();
  return {
    id: 'https://example.com/jobs/123',
    url: 'https://example.com/jobs/123',
    title: 'Senior Backend Engineer',
    description: 'We are looking for an experienced backend engineer with strong skills in distributed systems, microservices, and cloud infrastructure. Experience with Kafka, Redis, and AWS is required.',
    company: 'Example Corp',
    location: 'Seattle, WA (Hybrid)',
    score: 8.5,
    reasons: ['Strong keyword match: Kafka, distributed systems', 'Location preference matched', 'Senior level match'],
    decision: null,
    notes: '',
    tags: [],
    firstSeen: now,
    lastUpdated: now,
    ...overrides,
  };
}

/**
 * Create a mock Settings object
 */
export function createMockSettings(overrides?: Partial<Settings>): Settings {
  return {
    resume: 'Experienced software engineer with 5+ years in backend development. Expertise in distributed systems, Kafka, Redis, and AWS.',
    preferredStacks: ['Kafka', 'Redis', 'PostgreSQL', 'AWS'],
    preferredRoles: ['Backend Engineer', 'Platform Engineer', 'SRE'],
    locationPreferences: {
      remote: true,
      hybrid: true,
      onsite: false,
      cities: ['Seattle', 'San Francisco'],
    },
    scoringWeights: {
      similarity: 0.6,
      keyword: 0.2,
      role: 0.1,
      location: 0.1,
    },
    scoreThreshold: 7.0,
    ...overrides,
  };
}

/**
 * Create a mock Profile object
 */
export function createMockProfile(overrides?: Partial<Profile>): Profile {
  return {
    id: 'profile-1',
    name: 'Backend Heavy',
    settings: {
      preferredStacks: ['Kafka', 'Go', 'Kubernetes'],
      preferredRoles: ['Backend Engineer', 'Platform Engineer'],
    },
    createdAt: Date.now(),
    ...overrides,
  };
}

/**
 * Create a mock Embedding object
 */
export function createMockEmbedding(overrides?: Partial<Embedding>): Embedding {
  return {
    hash: 'abc123def456',
    vector: new Array(384).fill(0).map(() => Math.random()),
    modelVersion: 'all-MiniLM-L6-v2',
    createdAt: Date.now(),
    ...overrides,
  };
}

/**
 * Create multiple mock jobs with varied scores
 */
export function createMockJobs(count: number): Job[] {
  return Array.from({ length: count }, (_, i) =>
    createMockJob({
      id: `https://example.com/jobs/${i + 1}`,
      url: `https://example.com/jobs/${i + 1}`,
      title: `Job Title ${i + 1}`,
      score: 5 + Math.random() * 5, // Scores between 5-10
    })
  );
}
