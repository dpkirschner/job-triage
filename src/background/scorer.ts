/**
 * Job scoring engine - Keyword-based scoring for Phase 1 MVP
 *
 * Scoring formula: score = 0.2 × keyword + 0.1 × role + 0.1 × location + 6.0 baseline
 *
 * Phase 2 will add embeddings (0.6 × similarity component)
 */

import { Job, Settings } from '../shared/types';

/**
 * Breakdown of score components
 */
export interface ScoringBreakdown {
  keyword: number;
  role: number;
  location: number;
  baseline: number;
}

/**
 * Result of scoring a job
 */
export interface ScoringResult {
  score: number;
  reasons: string[];
  breakdown: ScoringBreakdown;
}

/**
 * Matched keyword details for explanation generation
 */
interface KeywordMatches {
  matched: string[];
  missing: string[];
  total: number;
}

/**
 * Known technical keywords for matching
 */
const TECH_KEYWORDS = {
  languages: [
    'python', 'java', 'javascript', 'typescript', 'go', 'golang', 'rust',
    'c++', 'cpp', 'c#', 'csharp', 'ruby', 'php', 'swift', 'kotlin',
    'scala', 'elixir', 'clojure', 'haskell', 'r', 'matlab', 'sql'
  ],
  frameworks: [
    'react', 'vue', 'angular', 'svelte', 'next.js', 'nextjs',
    'django', 'flask', 'fastapi', 'spring', 'spring boot', 'springboot',
    'express', 'nestjs', 'rails', 'laravel',
    'kafka', 'flink', 'spark', 'hadoop',
    'kubernetes', 'k8s', 'docker', 'terraform',
    'pytorch', 'tensorflow', 'scikit-learn', 'sklearn'
  ],
  cloud: [
    'aws', 'amazon web services', 'azure', 'gcp', 'google cloud',
    'ec2', 's3', 'lambda', 'cloudformation',
    'eks', 'ecs', 'rds', 'dynamodb', 'redshift'
  ],
  databases: [
    'postgresql', 'postgres', 'mysql', 'mongodb', 'redis',
    'cassandra', 'elasticsearch', 'dynamodb', 'sqlite',
    'oracle', 'sql server', 'mariadb', 'couchbase'
  ],
  tools: [
    'git', 'github', 'gitlab', 'bitbucket',
    'jenkins', 'circleci', 'github actions',
    'datadog', 'grafana', 'prometheus', 'splunk',
    'nginx', 'apache', 'graphql', 'rest', 'grpc'
  ],
  concepts: [
    'distributed systems', 'microservices', 'machine learning', 'ml',
    'artificial intelligence', 'ai', 'deep learning',
    'devops', 'sre', 'site reliability', 'ci/cd',
    'data engineering', 'data science', 'analytics',
    'backend', 'frontend', 'full stack', 'full-stack',
    'api design', 'system design', 'scalability',
    'reliability', 'observability', 'monitoring'
  ]
} as const;

/**
 * Stop words to filter out during keyword extraction
 */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
  'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'should', 'could', 'may', 'might', 'must', 'can', 'about',
  'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there',
  'when', 'where', 'why', 'how', 'all', 'both', 'each', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
  'same', 'so', 'than', 'too', 'very', 'this', 'that', 'these', 'those'
]);

/**
 * Common role keywords for matching
 */
const ROLE_KEYWORDS = {
  backend: ['backend', 'back-end', 'back end', 'server', 'api', 'microservices'],
  frontend: ['frontend', 'front-end', 'front end', 'ui', 'ux', 'web', 'react', 'vue', 'angular'],
  fullstack: ['full stack', 'full-stack', 'fullstack'],
  platform: ['platform', 'infrastructure', 'infra', 'devops', 'sre', 'site reliability'],
  data: ['data engineer', 'data engineering', 'data science', 'data scientist', 'ml engineer', 'analytics'],
  mobile: ['mobile', 'ios', 'android', 'react native', 'flutter'],
  embedded: ['embedded', 'firmware', 'iot', 'hardware'],
  security: ['security', 'cybersecurity', 'infosec', 'appsec']
} as const;

/**
 * Location keywords for matching
 */
const LOCATION_KEYWORDS = {
  remote: ['remote', 'work from home', 'wfh', 'distributed', 'anywhere', 'virtual'],
  hybrid: ['hybrid', 'flexible', 'flex', 'office optional', 'remote friendly'],
  onsite: ['onsite', 'on-site', 'in office', 'in-office', 'office']
} as const;

/**
 * Extract keywords from text
 * Normalizes, tokenizes, and filters technical terms
 *
 * @param text - Text to extract keywords from
 * @returns Array of normalized keywords
 */
export function extractKeywords(text: string): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const normalized = text.toLowerCase();
  const keywords = new Set<string>();

  // Extract all tech keywords from our taxonomy
  const allTechKeywords: string[] = [
    ...TECH_KEYWORDS.languages,
    ...TECH_KEYWORDS.frameworks,
    ...TECH_KEYWORDS.cloud,
    ...TECH_KEYWORDS.databases,
    ...TECH_KEYWORDS.tools,
    ...TECH_KEYWORDS.concepts
  ];

  // Match multi-word phrases first (e.g., "distributed systems")
  for (const keyword of allTechKeywords) {
    if (keyword.includes(' ') && normalized.includes(keyword)) {
      keywords.add(keyword);
    }
  }

  // Tokenize and match single-word keywords
  const tokens = normalized
    .split(/[\s,;.!?()[\]{}'"]+/)
    .filter(token => token.length > 0);

  for (const token of tokens) {
    // Skip stop words and short tokens
    if (STOP_WORDS.has(token) || token.length < 2) {
      continue;
    }

    // Check if token is a known tech keyword
    if (allTechKeywords.includes(token)) {
      keywords.add(token);
    }
  }

  return Array.from(keywords);
}

/**
 * Compute keyword score based on resume and job description match
 *
 * @param jobDescription - Job description text
 * @param resumeKeywords - Keywords from user's resume
 * @param preferredStacks - User's preferred tech stacks
 * @returns Score between 0 and 1
 */
function computeKeywordScore(
  jobDescription: string,
  resumeKeywords: string[],
  preferredStacks: string[]
): { score: number; matches: KeywordMatches } {
  const jobKeywords = extractKeywords(jobDescription);
  const preferredKeywords = preferredStacks.map(s => s.toLowerCase());

  // Find matches
  const matched = new Set<string>();
  const resumeSet = new Set(resumeKeywords);
  const preferredSet = new Set(preferredKeywords);

  for (const keyword of jobKeywords) {
    if (resumeSet.has(keyword) || preferredSet.has(keyword)) {
      matched.add(keyword);
    }
  }

  // Calculate score
  const totalImportantKeywords = new Set([...resumeKeywords, ...preferredKeywords]).size;
  const matchCount = matched.size;

  // Boost matches for preferred stacks (1.5x weight)
  const preferredMatches = Array.from(matched).filter(k => preferredSet.has(k)).length;
  const effectiveMatches = matchCount + (preferredMatches * 0.5);

  const score = totalImportantKeywords > 0
    ? Math.min(1.0, effectiveMatches / totalImportantKeywords)
    : 0.0;

  // Find missing important keywords
  const allImportant = new Set([...resumeKeywords, ...preferredKeywords]);
  const missing = Array.from(allImportant).filter(k => !matched.has(k));

  return {
    score,
    matches: {
      matched: Array.from(matched),
      missing: missing.slice(0, 5), // Limit to top 5 missing
      total: totalImportantKeywords
    }
  };
}

/**
 * Compute role score based on job title and description
 *
 * @param jobTitle - Job title
 * @param jobDescription - Job description text
 * @param preferredRoles - User's preferred role types
 * @returns Score between -0.5 and 1.0
 */
function computeRoleScore(
  jobTitle: string,
  jobDescription: string,
  preferredRoles: string[]
): { score: number; matchedRole: string | null; mismatchedRole: string | null } {
  const normalizedTitle = jobTitle.toLowerCase();
  const normalizedDescription = jobDescription.toLowerCase();
  const normalizedPreferences = preferredRoles.map(r => r.toLowerCase());

  let bestScore = 0.0;
  let matchedRole: string | null = null;
  let mismatchedRole: string | null = null;

  // Check each role category
  for (const [roleCategory, keywords] of Object.entries(ROLE_KEYWORDS)) {
    const isPreferred = normalizedPreferences.some(pref => pref.includes(roleCategory));

    // Check if job title mentions this role
    const titleMatch = keywords.some(keyword => normalizedTitle.includes(keyword));

    // Check if description mentions this role (first 500 chars)
    const descriptionMatch = keywords.some(keyword =>
      normalizedDescription.slice(0, 500).includes(keyword)
    );

    if (titleMatch) {
      if (isPreferred) {
        bestScore = Math.max(bestScore, 1.0);
        matchedRole = roleCategory;
      } else {
        // Mismatch: job title emphasizes non-preferred role
        bestScore = Math.min(bestScore, -0.5);
        mismatchedRole = roleCategory;
      }
    } else if (descriptionMatch) {
      if (isPreferred) {
        bestScore = Math.max(bestScore, 0.5);
        matchedRole = roleCategory;
      }
    }
  }

  return { score: bestScore, matchedRole, mismatchedRole };
}

/**
 * Compute location score based on job location and user preferences
 *
 * @param jobLocation - Job location string
 * @param jobDescription - Job description text
 * @param locationPreferences - User's location preferences
 * @returns Score between -2.0 and 1.0
 */
function computeLocationScore(
  jobLocation: string | undefined,
  jobDescription: string,
  locationPreferences: Settings['locationPreferences']
): { score: number; matchType: string | null } {
  const text = `${jobLocation || ''} ${jobDescription}`.toLowerCase();

  // Check for remote
  const isRemote = LOCATION_KEYWORDS.remote.some(keyword => text.includes(keyword));
  if (isRemote) {
    if (locationPreferences.remote) {
      return { score: 1.0, matchType: 'remote' };
    } else if (locationPreferences.hybrid) {
      return { score: 0.5, matchType: 'remote (acceptable)' };
    } else {
      return { score: -0.5, matchType: 'remote (not preferred)' };
    }
  }

  // Check for hybrid
  const isHybrid = LOCATION_KEYWORDS.hybrid.some(keyword => text.includes(keyword));
  if (isHybrid) {
    if (locationPreferences.hybrid) {
      return { score: 1.0, matchType: 'hybrid' };
    } else if (locationPreferences.remote) {
      return { score: 0.5, matchType: 'hybrid (acceptable)' };
    } else if (locationPreferences.onsite) {
      return { score: 0.5, matchType: 'hybrid (acceptable)' };
    }
  }

  // Check for specific cities
  if (locationPreferences.cities && locationPreferences.cities.length > 0) {
    const matchedCity = locationPreferences.cities.find(city =>
      text.includes(city.toLowerCase())
    );
    if (matchedCity) {
      return { score: 1.0, matchType: `onsite (${matchedCity})` };
    }
  }

  // Check for onsite
  const isOnsite = LOCATION_KEYWORDS.onsite.some(keyword => text.includes(keyword));
  if (isOnsite) {
    if (locationPreferences.onsite) {
      return { score: 0.5, matchType: 'onsite' }; // Lower score since city not confirmed
    } else {
      return { score: -5.0, matchType: 'onsite (dealbreaker)' }; // Hard mismatch - large penalty
    }
  }

  // No clear location signal - might be onsite without explicit mention
  // If user doesn't want onsite, apply small penalty as a precaution
  if (!locationPreferences.onsite && !locationPreferences.remote && !locationPreferences.hybrid) {
    return { score: 0.0, matchType: null };
  }

  // If no location mentioned but user prefers remote/hybrid, apply small penalty
  if ((locationPreferences.remote || locationPreferences.hybrid) && !locationPreferences.onsite) {
    return { score: -0.5, matchType: 'location unclear' };
  }

  return { score: 0.0, matchType: null };
}

/**
 * Generate human-readable reasons for the score
 *
 * @param breakdown - Score breakdown
 * @param keywordMatches - Keyword match details
 * @param roleMatch - Role match details
 * @param locationMatch - Location match details
 * @returns Array of 3-5 reason strings
 */
function generateReasons(
  breakdown: ScoringBreakdown,
  keywordMatches: KeywordMatches,
  roleMatch: { matchedRole: string | null; mismatchedRole: string | null },
  locationMatch: { matchType: string | null }
): string[] {
  const reasons: string[] = [];

  // Add keyword matches (top 3)
  if (keywordMatches.matched.length > 0) {
    const topMatches = keywordMatches.matched.slice(0, 3).join(', ');
    reasons.push(`✓ Strong match: ${topMatches}`);
  }

  // Add role match/mismatch
  if (roleMatch.matchedRole) {
    reasons.push(`✓ Role match: ${roleMatch.matchedRole}`);
  } else if (roleMatch.mismatchedRole) {
    reasons.push(`⚠ Role mismatch: ${roleMatch.mismatchedRole} (not preferred)`);
  }

  // Add location match
  if (locationMatch.matchType) {
    if (breakdown.location >= 0.5) {
      reasons.push(`✓ Location: ${locationMatch.matchType}`);
    } else if (breakdown.location < 0) {
      reasons.push(`⚠ Location: ${locationMatch.matchType}`);
    }
  }

  // Add missing keywords (red flag) - show if we have significant missing keywords
  if (keywordMatches.missing.length > 0 && keywordMatches.matched.length < keywordMatches.total) {
    const topMissing = keywordMatches.missing.slice(0, 2).join(', ');
    reasons.push(`⚠ Missing: ${topMissing}`);
  }

  // Ensure we have at least 3 reasons
  if (reasons.length === 0) {
    reasons.push('⚠ Limited information available for scoring');
  }

  // Limit to 5 reasons
  return reasons.slice(0, 5);
}

/**
 * Score a job based on user preferences
 *
 * @param job - Job to score (must include description)
 * @param settings - User settings (resume, preferences, weights)
 * @returns Scoring result with score, reasons, and breakdown
 */
export async function scoreJob(
  job: Partial<Job>,
  settings: Settings
): Promise<ScoringResult> {
  // Validate inputs
  if (!job.description || job.description.trim().length === 0) {
    return {
      score: 0,
      reasons: ['⚠ No job description available'],
      breakdown: { keyword: 0, role: 0, location: 0, baseline: 0 }
    };
  }

  // Extract keywords from resume (cache in real implementation)
  const resumeKeywords = extractKeywords(settings.resume);

  // Compute keyword score
  const keywordResult = computeKeywordScore(
    job.description,
    resumeKeywords,
    settings.preferredStacks
  );

  // Compute role score
  const roleResult = computeRoleScore(
    job.title || '',
    job.description,
    settings.preferredRoles
  );

  // Compute location score
  const locationResult = computeLocationScore(
    job.location,
    job.description,
    settings.locationPreferences
  );

  // Build breakdown
  const breakdown: ScoringBreakdown = {
    keyword: keywordResult.score,
    role: roleResult.score,
    location: locationResult.score,
    baseline: 6.0
  };

  // Apply weights and compute final score
  const weights = settings.scoringWeights;
  const finalScore = Math.max(0, Math.min(10,
    breakdown.baseline +
    (weights.keyword * breakdown.keyword * 10) +
    (weights.role * breakdown.role * 10) +
    (weights.location * breakdown.location * 10)
  ));

  // Generate reasons
  const reasons = generateReasons(
    breakdown,
    keywordResult.matches,
    roleResult,
    locationResult
  );

  return {
    score: Math.round(finalScore * 10) / 10, // Round to 1 decimal
    reasons,
    breakdown
  };
}

/**
 * Batch score multiple jobs
 *
 * @param jobs - Jobs to score
 * @param settings - User settings
 * @returns Array of scoring results
 */
export async function scoreJobs(
  jobs: Partial<Job>[],
  settings: Settings
): Promise<ScoringResult[]> {
  // Score all jobs in parallel
  return Promise.all(jobs.map(job => scoreJob(job, settings)));
}
