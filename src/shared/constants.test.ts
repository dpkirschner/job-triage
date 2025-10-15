/**
 * Tests for application constants
 */

import { describe, it, expect } from 'vitest';
import {
  APP_NAME,
  APP_VERSION,
  DEFAULT_SCORING_WEIGHTS,
  DEFAULT_SCORE_THRESHOLD,
  PERFORMANCE,
  CACHE,
  DEFAULT_SETTINGS,
  ATS_PATTERNS,
  OVERLAY,
} from './constants';

describe('App Metadata', () => {
  it('should have valid app name', () => {
    expect(APP_NAME).toBe('Job Triage');
    expect(APP_NAME).toHaveLength(10);
  });

  it('should have valid semantic version', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(APP_VERSION).toBe('0.1.0');
  });
});

describe('DEFAULT_SCORING_WEIGHTS', () => {
  it('should sum to 1.0', () => {
    const sum =
      DEFAULT_SCORING_WEIGHTS.similarity +
      DEFAULT_SCORING_WEIGHTS.keyword +
      DEFAULT_SCORING_WEIGHTS.role +
      DEFAULT_SCORING_WEIGHTS.location;

    expect(sum).toBeCloseTo(1.0);
  });

  it('should prioritize similarity', () => {
    expect(DEFAULT_SCORING_WEIGHTS.similarity).toBe(0.6);
    expect(DEFAULT_SCORING_WEIGHTS.similarity).toBeGreaterThan(DEFAULT_SCORING_WEIGHTS.keyword);
    expect(DEFAULT_SCORING_WEIGHTS.similarity).toBeGreaterThan(DEFAULT_SCORING_WEIGHTS.role);
    expect(DEFAULT_SCORING_WEIGHTS.similarity).toBeGreaterThan(DEFAULT_SCORING_WEIGHTS.location);
  });

  it('should have valid weight values', () => {
    Object.values(DEFAULT_SCORING_WEIGHTS).forEach((weight) => {
      expect(weight).toBeGreaterThanOrEqual(0);
      expect(weight).toBeLessThanOrEqual(1);
    });
  });

  it('should match documented formula', () => {
    expect(DEFAULT_SCORING_WEIGHTS.similarity).toBe(0.6);
    expect(DEFAULT_SCORING_WEIGHTS.keyword).toBe(0.2);
    expect(DEFAULT_SCORING_WEIGHTS.role).toBe(0.1);
    expect(DEFAULT_SCORING_WEIGHTS.location).toBe(0.1);
  });
});

describe('DEFAULT_SCORE_THRESHOLD', () => {
  it('should be a reasonable value', () => {
    expect(DEFAULT_SCORE_THRESHOLD).toBe(7.0);
    expect(DEFAULT_SCORE_THRESHOLD).toBeGreaterThan(0);
    expect(DEFAULT_SCORE_THRESHOLD).toBeLessThanOrEqual(10);
  });
});

describe('PERFORMANCE', () => {
  it('should have reasonable concurrent fetch limit', () => {
    expect(PERFORMANCE.MAX_CONCURRENT_FETCHES).toBe(3);
    expect(PERFORMANCE.MAX_CONCURRENT_FETCHES).toBeGreaterThan(0);
    expect(PERFORMANCE.MAX_CONCURRENT_FETCHES).toBeLessThanOrEqual(10);
  });

  it('should have reasonable fetch timeout', () => {
    expect(PERFORMANCE.FETCH_TIMEOUT).toBe(10000); // 10 seconds
    expect(PERFORMANCE.FETCH_TIMEOUT).toBeGreaterThan(1000); // At least 1 second
  });

  it('should have target scoring time under 1 second', () => {
    expect(PERFORMANCE.TARGET_SCORING_TIME).toBe(100); // 100ms
    expect(PERFORMANCE.TARGET_SCORING_TIME).toBeLessThan(1000);
  });
});

describe('CACHE', () => {
  it('should have 7-day job TTL', () => {
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    expect(CACHE.JOB_TTL).toBe(sevenDays);
  });

  it('should have 30-day embedding TTL', () => {
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    expect(CACHE.EMBEDDING_TTL).toBe(thirtyDays);
  });

  it('should have longer embedding TTL than job TTL', () => {
    expect(CACHE.EMBEDDING_TTL).toBeGreaterThan(CACHE.JOB_TTL);
  });
});

describe('DEFAULT_SETTINGS', () => {
  it('should have empty resume by default', () => {
    expect(DEFAULT_SETTINGS.resume).toBe('');
  });

  it('should have empty preferred stacks and roles', () => {
    expect(DEFAULT_SETTINGS.preferredStacks).toEqual([]);
    expect(DEFAULT_SETTINGS.preferredRoles).toEqual([]);
  });

  it('should prefer remote and hybrid by default', () => {
    expect(DEFAULT_SETTINGS.locationPreferences.remote).toBe(true);
    expect(DEFAULT_SETTINGS.locationPreferences.hybrid).toBe(true);
    expect(DEFAULT_SETTINGS.locationPreferences.onsite).toBe(false);
  });

  it('should have default scoring weights', () => {
    expect(DEFAULT_SETTINGS.scoringWeights).toEqual(DEFAULT_SCORING_WEIGHTS);
  });

  it('should have default score threshold', () => {
    expect(DEFAULT_SETTINGS.scoreThreshold).toBe(DEFAULT_SCORE_THRESHOLD);
  });

  it('should have valid structure', () => {
    expect(DEFAULT_SETTINGS).toHaveProperty('resume');
    expect(DEFAULT_SETTINGS).toHaveProperty('preferredStacks');
    expect(DEFAULT_SETTINGS).toHaveProperty('preferredRoles');
    expect(DEFAULT_SETTINGS).toHaveProperty('locationPreferences');
    expect(DEFAULT_SETTINGS).toHaveProperty('scoringWeights');
    expect(DEFAULT_SETTINGS).toHaveProperty('scoreThreshold');
  });
});

describe('ATS_PATTERNS', () => {
  it('should include major ATS platforms', () => {
    expect(ATS_PATTERNS).toHaveProperty('greenhouse');
    expect(ATS_PATTERNS).toHaveProperty('lever');
    expect(ATS_PATTERNS).toHaveProperty('ashby');
    expect(ATS_PATTERNS).toHaveProperty('workable');
  });

  it('should have valid regex patterns', () => {
    Object.values(ATS_PATTERNS).forEach((pattern) => {
      expect(pattern).toBeInstanceOf(RegExp);
    });
  });

  it('should match greenhouse URLs', () => {
    expect(ATS_PATTERNS.greenhouse.test('https://boards.greenhouse.io/company/jobs/123')).toBe(true);
    expect(ATS_PATTERNS.greenhouse.test('https://example.com')).toBe(false);
  });

  it('should match lever URLs', () => {
    expect(ATS_PATTERNS.lever.test('https://jobs.lever.co/company/job-id')).toBe(true);
    expect(ATS_PATTERNS.lever.test('https://example.com')).toBe(false);
  });

  it('should match ashby URLs', () => {
    expect(ATS_PATTERNS.ashby.test('https://jobs.ashbyhq.com/company')).toBe(true);
    expect(ATS_PATTERNS.ashby.test('https://example.com')).toBe(false);
  });

  it('should match workable URLs', () => {
    expect(ATS_PATTERNS.workable.test('https://apply.workable.com/company/')).toBe(true);
    expect(ATS_PATTERNS.workable.test('https://example.com')).toBe(false);
  });

  it('should be case insensitive', () => {
    expect(ATS_PATTERNS.greenhouse.test('https://GREENHOUSE.io/company')).toBe(true);
    expect(ATS_PATTERNS.lever.test('https://LEVER.co/company')).toBe(true);
  });
});

describe('OVERLAY', () => {
  it('should have high z-index to appear above content', () => {
    expect(OVERLAY.Z_INDEX).toBe(10000);
    expect(OVERLAY.Z_INDEX).toBeGreaterThan(1000);
  });

  it('should have unique container ID', () => {
    expect(OVERLAY.CONTAINER_ID).toBe('job-triage-overlay');
    expect(OVERLAY.CONTAINER_ID).toMatch(/^[a-z-]+$/);
  });
});
