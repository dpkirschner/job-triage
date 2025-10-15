/**
 * Core type definitions for Job Triage extension
 */

/**
 * Represents a single job listing
 */
export interface Job {
  /** Unique identifier (normalized URL) */
  id: string;
  /** Job posting URL */
  url: string;
  /** Job title */
  title: string;
  /** Full job description text */
  description: string;
  /** Company name (if available) */
  company?: string;
  /** Location (if available) */
  location?: string;
  /** Computed relevance score (0-10) */
  score?: number;
  /** Explanation for the score */
  reasons?: string[];
  /** User's decision on this job */
  decision?: 'thumbs_up' | 'thumbs_down' | null;
  /** User notes */
  notes?: string;
  /** Tags applied by user */
  tags?: string[];
  /** When this job was first seen */
  firstSeen: number;
  /** When this job was last updated */
  lastUpdated: number;
}

/**
 * User settings and preferences
 */
export interface Settings {
  /** User's resume text */
  resume: string;
  /** Preferred tech stacks/keywords */
  preferredStacks: string[];
  /** Preferred role types */
  preferredRoles: string[];
  /** Location preferences */
  locationPreferences: {
    remote: boolean;
    hybrid: boolean;
    onsite: boolean;
    cities?: string[];
  };
  /** Scoring weights */
  scoringWeights: {
    similarity: number;
    keyword: number;
    role: number;
    location: number;
  };
  /** Minimum score threshold for display */
  scoreThreshold: number;
}

/**
 * Saved user profile preset
 */
export interface Profile {
  /** Profile identifier */
  id: string;
  /** Profile name */
  name: string;
  /** Profile settings */
  settings: Partial<Settings>;
  /** When created */
  createdAt: number;
}

/**
 * Cached embedding for resume or job description
 */
export interface Embedding {
  /** Hash of the text that was embedded */
  hash: string;
  /** The embedding vector */
  vector: number[];
  /** Model version used */
  modelVersion: string;
  /** When created */
  createdAt: number;
}

/**
 * Message types for communication between content script and background worker
 */
export type Message =
  | { type: 'FETCH_JOB'; url: string }
  | { type: 'FETCH_JOB_RESPONSE'; job: Partial<Job>; error?: string }
  | { type: 'COMPUTE_SCORE'; job: Partial<Job> }
  | { type: 'COMPUTE_SCORE_RESPONSE'; score: number; reasons: string[] }
  | { type: 'GET_SETTINGS' }
  | { type: 'GET_SETTINGS_RESPONSE'; settings: Settings }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<Settings> }
  | { type: 'SAVE_DECISION'; jobId: string; decision: 'thumbs_up' | 'thumbs_down' };

/**
 * Storage keys for IndexedDB and chrome.storage
 */
export const StorageKeys = {
  JOBS: 'jobs',
  SETTINGS: 'settings',
  PROFILES: 'profiles',
  EMBEDDINGS: 'embeddings',
} as const;
