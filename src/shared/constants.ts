/**
 * Application constants and configuration
 */

export const APP_NAME = 'Job Triage';
export const APP_VERSION = '0.1.0';

/**
 * Default scoring weights
 * Formula: score = 0.6 * similarity + 0.2 * keyword + 0.1 * role + 0.1 * location
 */
export const DEFAULT_SCORING_WEIGHTS = {
  similarity: 0.6,
  keyword: 0.2,
  role: 0.1,
  location: 0.1,
} as const;

/**
 * Default score threshold for display
 */
export const DEFAULT_SCORE_THRESHOLD = 7.0;

/**
 * Performance targets
 */
export const PERFORMANCE = {
  /** Maximum concurrent job fetches */
  MAX_CONCURRENT_FETCHES: 3,
  /** Fetch timeout in milliseconds */
  FETCH_TIMEOUT: 10000,
  /** Target scoring time per job in milliseconds */
  TARGET_SCORING_TIME: 100,
} as const;

/**
 * Cache configuration
 */
export const CACHE = {
  /** Job cache TTL in milliseconds (7 days) */
  JOB_TTL: 7 * 24 * 60 * 60 * 1000,
  /** Embedding cache TTL in milliseconds (30 days) */
  EMBEDDING_TTL: 30 * 24 * 60 * 60 * 1000,
} as const;

/**
 * Default settings
 */
export const DEFAULT_SETTINGS = {
  resume: '',
  preferredStacks: [] as string[],
  preferredRoles: [] as string[],
  locationPreferences: {
    remote: true,
    hybrid: true,
    onsite: false,
    cities: [] as string[],
  },
  scoringWeights: {
    similarity: 0.6,
    keyword: 0.2,
    role: 0.1,
    location: 0.1,
  },
  scoreThreshold: DEFAULT_SCORE_THRESHOLD,
};

/**
 * Known ATS patterns for job page detection
 */
export const ATS_PATTERNS = {
  greenhouse: /greenhouse\.io/i,
  lever: /lever\.co/i,
  ashby: /ashbyhq\.com/i,
  workable: /workable\.com/i,
} as const;

/**
 * Overlay UI configuration
 */
export const OVERLAY = {
  /** Z-index for overlay */
  Z_INDEX: 10000,
  /** Overlay container ID */
  CONTAINER_ID: 'job-triage-overlay',
} as const;
