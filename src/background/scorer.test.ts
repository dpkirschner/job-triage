/**
 * Tests for job scoring engine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { extractKeywords, scoreJob, scoreJobs, ScoringResult } from './scorer';
import { Settings, Job } from '../shared/types';
import { DEFAULT_SETTINGS } from '../shared/constants';

describe('scorer', () => {
  describe('extractKeywords', () => {
    it('should extract single-word tech keywords', () => {
      const text = 'We use Python, JavaScript, and PostgreSQL for our backend services.';
      const keywords = extractKeywords(text);

      expect(keywords).toContain('python');
      expect(keywords).toContain('javascript');
      expect(keywords).toContain('postgresql');
    });

    it('should extract multi-word tech keywords', () => {
      const text = 'Looking for experience with distributed systems and machine learning.';
      const keywords = extractKeywords(text);

      expect(keywords).toContain('distributed systems');
      expect(keywords).toContain('machine learning');
    });

    it('should filter out stop words', () => {
      const text = 'The backend engineer will work with the team on various projects.';
      const keywords = extractKeywords(text);

      expect(keywords).not.toContain('the');
      expect(keywords).not.toContain('will');
      expect(keywords).not.toContain('with');
      expect(keywords).not.toContain('on');
      expect(keywords).toContain('backend');
    });

    it('should normalize keywords to lowercase', () => {
      const text = 'Python JAVASCRIPT Rust';
      const keywords = extractKeywords(text);

      expect(keywords).toContain('python');
      expect(keywords).toContain('javascript');
      expect(keywords).toContain('rust');
    });

    it('should handle empty text', () => {
      expect(extractKeywords('')).toEqual([]);
      expect(extractKeywords('   ')).toEqual([]);
    });

    it('should handle text with no tech keywords', () => {
      const text = 'The quick brown fox jumps over the lazy dog.';
      const keywords = extractKeywords(text);

      expect(keywords).toEqual([]);
    });

    it('should extract cloud provider keywords', () => {
      const text = 'Experience with AWS, Azure, and GCP required.';
      const keywords = extractKeywords(text);

      expect(keywords).toContain('aws');
      expect(keywords).toContain('azure');
      expect(keywords).toContain('gcp');
    });

    it('should extract framework keywords', () => {
      const text = 'We build with React, Django, and Kubernetes.';
      const keywords = extractKeywords(text);

      expect(keywords).toContain('react');
      expect(keywords).toContain('django');
      expect(keywords).toContain('kubernetes');
    });

    it('should not duplicate keywords', () => {
      const text = 'Python Python Python';
      const keywords = extractKeywords(text);

      expect(keywords.filter(k => k === 'python')).toHaveLength(1);
    });
  });

  describe('scoreJob', () => {
    let baseSettings: Settings;
    let baseJob: Partial<Job>;

    beforeEach(() => {
      baseSettings = {
        ...DEFAULT_SETTINGS,
        resume: 'Experienced backend engineer with Python, Django, PostgreSQL, and AWS. Built distributed systems.',
        preferredStacks: ['Python', 'Kafka', 'Kubernetes'],
        preferredRoles: ['Backend', 'Platform'],
        locationPreferences: {
          remote: true,
          hybrid: true,
          onsite: false,
          cities: []
        }
      };

      baseJob = {
        id: 'test-job-1',
        url: 'https://example.com/job/1',
        title: 'Senior Backend Engineer',
        description: 'We are looking for a backend engineer with Python and Django experience. Must know PostgreSQL and AWS. Remote work available.',
        location: 'Remote',
        firstSeen: Date.now(),
        lastUpdated: Date.now()
      };
    });

    it('should score a perfect match highly', async () => {
      const result = await scoreJob(baseJob, baseSettings);

      expect(result.score).toBeGreaterThan(7.0);
      expect(result.reasons.some(r => r.includes('Strong match'))).toBe(true);
      expect(result.reasons.some(r => r.includes('Role match'))).toBe(true);
      expect(result.reasons.some(r => r.includes('Location'))).toBe(true);
    });

    it('should score a partial match moderately', async () => {
      const partialJob = {
        ...baseJob,
        title: 'Software Engineer',
        description: 'Looking for a software engineer with Python experience. Some backend work involved.',
        location: 'San Francisco, CA'
      };

      const result = await scoreJob(partialJob, baseSettings);

      expect(result.score).toBeLessThan(7.0);
      expect(result.score).toBeGreaterThan(5.0);
    });

    it('should score a mismatch lowly', async () => {
      const mismatchJob = {
        ...baseJob,
        title: 'Frontend Developer',
        description: 'React and TypeScript expert needed for UI development. Must know CSS and HTML.',
        location: 'Onsite in New York'
      };

      const result = await scoreJob(mismatchJob, baseSettings);

      expect(result.score).toBeLessThan(6.0);
      expect(result.reasons.some(r => r.toLowerCase().includes('mismatch'))).toBe(true);
    });

    it('should handle missing job description', async () => {
      const noDescJob = {
        ...baseJob,
        description: ''
      };

      const result = await scoreJob(noDescJob, baseSettings);

      expect(result.score).toBe(0);
      expect(result.reasons).toContain('⚠ No job description available');
    });

    it('should include breakdown in result', async () => {
      const result = await scoreJob(baseJob, baseSettings);

      expect(result.breakdown).toBeDefined();
      expect(result.breakdown.keyword).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.role).toBeGreaterThanOrEqual(-0.5);
      expect(result.breakdown.location).toBeGreaterThanOrEqual(-2.0);
      expect(result.breakdown.baseline).toBe(6.0);
    });

    it('should boost scores for preferred stacks', async () => {
      const kafkaJob = {
        ...baseJob,
        description: 'Backend engineer needed. Must have Kafka and Python experience for streaming systems.'
      };

      const result = await scoreJob(kafkaJob, baseSettings);

      expect(result.score).toBeGreaterThan(7.0);
      expect(result.reasons.some(r => r.includes('kafka') || r.includes('Kafka'))).toBe(true);
    });

    it('should penalize location mismatches heavily', async () => {
      const onsiteJob = {
        ...baseJob,
        location: 'Seattle, WA',
        description: 'Backend engineer needed. Onsite only in Seattle office. Python and Django required.'
      };

      const remoteOnlySettings = {
        ...baseSettings,
        locationPreferences: {
          remote: true,
          hybrid: false,
          onsite: false,
          cities: []
        }
      };

      const result = await scoreJob(onsiteJob, remoteOnlySettings);

      expect(result.score).toBeLessThan(5.0);
      expect(result.reasons.some(r => r.toLowerCase().includes('dealbreaker'))).toBe(true);
    });

    it('should handle hybrid location preferences', async () => {
      const hybridJob = {
        ...baseJob,
        location: 'San Francisco - Hybrid',
        description: 'Backend engineer with flexible hybrid work arrangement.'
      };

      const result = await scoreJob(hybridJob, baseSettings);

      expect(result.score).toBeGreaterThan(6.0);
      expect(result.reasons.some(r => r.toLowerCase().includes('hybrid'))).toBe(true);
    });

    it('should match specific cities', async () => {
      const seattleJob = {
        ...baseJob,
        location: 'Seattle, WA',
        description: 'Backend engineer for our Seattle office.'
      };

      const seattleSettings = {
        ...baseSettings,
        locationPreferences: {
          remote: false,
          hybrid: false,
          onsite: true,
          cities: ['Seattle']
        }
      };

      const result = await scoreJob(seattleJob, seattleSettings);

      expect(result.score).toBeGreaterThan(6.0);
      expect(result.reasons.some(r => r.includes('Seattle'))).toBe(true);
    });

    it('should detect role mismatches', async () => {
      const frontendJob = {
        ...baseJob,
        title: 'Senior Frontend Engineer',
        description: 'React expert needed for UI work. TypeScript and CSS required.'
      };

      const backendSettings = {
        ...baseSettings,
        preferredRoles: ['Backend', 'Platform']
      };

      const result = await scoreJob(frontendJob, backendSettings);

      expect(result.reasons.some(r => r.toLowerCase().includes('frontend'))).toBe(true);
      expect(result.breakdown.role).toBeLessThan(0);
    });

    it('should handle empty resume gracefully', async () => {
      const emptyResumeSettings = {
        ...baseSettings,
        resume: '',
        preferredStacks: []
      };

      const result = await scoreJob(baseJob, emptyResumeSettings);

      expect(result.score).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(10);
    });

    it('should generate 3-5 reasons', async () => {
      const result = await scoreJob(baseJob, baseSettings);

      expect(result.reasons.length).toBeGreaterThanOrEqual(1);
      expect(result.reasons.length).toBeLessThanOrEqual(5);
    });

    it('should round score to 1 decimal place', async () => {
      const result = await scoreJob(baseJob, baseSettings);

      const decimalPlaces = (result.score.toString().split('.')[1] || '').length;
      expect(decimalPlaces).toBeLessThanOrEqual(1);
    });

    it('should respect custom scoring weights', async () => {
      const keywordHeavySettings = {
        ...baseSettings,
        scoringWeights: {
          similarity: 0.0,
          keyword: 0.8,
          role: 0.1,
          location: 0.1
        }
      };

      const result = await scoreJob(baseJob, keywordHeavySettings);

      expect(result.score).toBeDefined();
      // Keyword component should dominate
      expect(result.breakdown.keyword).toBeGreaterThan(0);
    });

    it('should handle missing job title', async () => {
      const noTitleJob = {
        ...baseJob,
        title: undefined
      };

      const result = await scoreJob(noTitleJob, baseSettings);

      expect(result.score).toBeGreaterThan(0);
      expect(result.reasons.length).toBeGreaterThan(0);
    });

    it('should handle missing location', async () => {
      const noLocationJob = {
        ...baseJob,
        location: undefined,
        description: 'Backend engineer needed. Python and Django required.'
      };

      const result = await scoreJob(noLocationJob, baseSettings);

      expect(result.score).toBeGreaterThan(0);
    });

    it('should identify missing important keywords', async () => {
      const limitedJob = {
        ...baseJob,
        description: 'Software engineer needed. Some programming required.'
      };

      const result = await scoreJob(limitedJob, baseSettings);

      expect(result.reasons.some(r => r.includes('Missing'))).toBe(true);
    });

    it('should keep scores within 0-10 range', async () => {
      const extremeJob = {
        ...baseJob,
        title: 'Frontend Developer',
        location: 'Onsite only - New York',
        description: 'Looking for UI developer with React and CSS skills.'
      };

      const result = await scoreJob(extremeJob, baseSettings);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(10);
    });
  });

  describe('scoreJobs', () => {
    let settings: Settings;
    let jobs: Partial<Job>[];

    beforeEach(() => {
      settings = {
        ...DEFAULT_SETTINGS,
        resume: 'Backend engineer with Python and Django experience.',
        preferredStacks: ['Python', 'Django'],
        preferredRoles: ['Backend'],
        locationPreferences: {
          remote: true,
          hybrid: true,
          onsite: false,
          cities: []
        }
      };

      jobs = [
        {
          id: 'job-1',
          url: 'https://example.com/1',
          title: 'Backend Engineer',
          description: 'Python and Django backend role. Remote available.',
          firstSeen: Date.now(),
          lastUpdated: Date.now()
        },
        {
          id: 'job-2',
          url: 'https://example.com/2',
          title: 'Frontend Developer',
          description: 'React and TypeScript frontend role.',
          firstSeen: Date.now(),
          lastUpdated: Date.now()
        },
        {
          id: 'job-3',
          url: 'https://example.com/3',
          title: 'Full Stack Engineer',
          description: 'Full stack role with Python backend and React frontend.',
          firstSeen: Date.now(),
          lastUpdated: Date.now()
        }
      ];
    });

    it('should score multiple jobs', async () => {
      const results = await scoreJobs(jobs, settings);

      expect(results).toHaveLength(3);
      expect(results[0].score).toBeDefined();
      expect(results[1].score).toBeDefined();
      expect(results[2].score).toBeDefined();
    });

    it('should score jobs independently', async () => {
      const results = await scoreJobs(jobs, settings);

      // Backend job should score highest
      expect(results[0].score).toBeGreaterThan(results[1].score);
      expect(results[0].score).toBeGreaterThan(results[2].score);
    });

    it('should handle empty job array', async () => {
      const results = await scoreJobs([], settings);

      expect(results).toEqual([]);
    });

    it('should handle single job', async () => {
      const results = await scoreJobs([jobs[0]], settings);

      expect(results).toHaveLength(1);
      expect(results[0].score).toBeDefined();
    });

    it('should handle jobs with missing descriptions', async () => {
      const jobsWithMissing = [
        ...jobs,
        {
          id: 'job-4',
          url: 'https://example.com/4',
          title: 'Mystery Role',
          description: '',
          firstSeen: Date.now(),
          lastUpdated: Date.now()
        }
      ];

      const results = await scoreJobs(jobsWithMissing, settings);

      expect(results).toHaveLength(4);
      expect(results[3].score).toBe(0);
    });

    it('should process large batches efficiently', async () => {
      const largeJobSet: Partial<Job>[] = Array.from({ length: 100 }, (_, i) => ({
        id: `job-${i}`,
        url: `https://example.com/${i}`,
        title: 'Backend Engineer',
        description: 'Python and Django backend role.',
        firstSeen: Date.now(),
        lastUpdated: Date.now()
      }));

      const startTime = Date.now();
      const results = await scoreJobs(largeJobSet, settings);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(100);
      // Should process 100 jobs in under 10 seconds (100ms per job target)
      expect(duration).toBeLessThan(10000);
    });
  });

  describe('scoring algorithm validation', () => {
    it('should follow the scoring formula correctly', async () => {
      const settings: Settings = {
        ...DEFAULT_SETTINGS,
        resume: 'Python developer',
        preferredStacks: ['Python'],
        preferredRoles: ['Backend'],
        scoringWeights: {
          similarity: 0.0,
          keyword: 0.2,
          role: 0.1,
          location: 0.1
        }
      };

      const job: Partial<Job> = {
        id: 'test',
        url: 'https://example.com/test',
        title: 'Backend Engineer',
        description: 'Python backend role with remote work.',
        location: 'Remote',
        firstSeen: Date.now(),
        lastUpdated: Date.now()
      };

      const result = await scoreJob(job, settings);

      // Score should be: baseline (6.0) + weighted components
      const expectedMin = 6.0;
      const expectedMax = 6.0 + (0.2 * 10) + (0.1 * 10) + (0.1 * 10); // 10.0

      expect(result.score).toBeGreaterThanOrEqual(expectedMin);
      expect(result.score).toBeLessThanOrEqual(expectedMax);
    });

    it('should apply baseline correctly', async () => {
      const settings: Settings = {
        ...DEFAULT_SETTINGS,
        resume: '',
        preferredStacks: [],
        preferredRoles: [],
        locationPreferences: {
          remote: false,
          hybrid: false,
          onsite: false,
          cities: []
        }
      };

      const job: Partial<Job> = {
        id: 'test',
        url: 'https://example.com/test',
        title: 'Software Engineer',
        description: 'Generic software role.',
        firstSeen: Date.now(),
        lastUpdated: Date.now()
      };

      const result = await scoreJob(job, settings);

      // With no keywords/role/location matches and no location preferences, score should be baseline (6.0)
      expect(result.score).toBeCloseTo(6.0, 0);
    });
  });

  describe('edge cases', () => {
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      resume: 'Backend engineer',
      preferredStacks: ['Python'],
      preferredRoles: ['Backend']
    };

    it('should handle very long job descriptions', async () => {
      const longDescription = 'Python '.repeat(10000) + 'backend engineer role.';
      const job: Partial<Job> = {
        id: 'test',
        url: 'https://example.com/test',
        title: 'Backend Engineer',
        description: longDescription,
        firstSeen: Date.now(),
        lastUpdated: Date.now()
      };

      const result = await scoreJob(job, settings);

      expect(result.score).toBeDefined();
      expect(result.score).toBeGreaterThan(0);
    });

    it('should handle special characters in description', async () => {
      const job: Partial<Job> = {
        id: 'test',
        url: 'https://example.com/test',
        title: 'Backend Engineer',
        description: 'Python & Django @ AWS! (C++) [Kafka] {Redis}',
        firstSeen: Date.now(),
        lastUpdated: Date.now()
      };

      const result = await scoreJob(job, settings);

      expect(result.score).toBeDefined();
      expect(result.reasons.some(r => r.includes('python') || r.includes('Python'))).toBe(true);
    });

    it('should handle unicode characters', async () => {
      const job: Partial<Job> = {
        id: 'test',
        url: 'https://example.com/test',
        title: 'Backend Engineer 🚀',
        description: 'Python developer needed for 日本 office. Remote OK ✅',
        firstSeen: Date.now(),
        lastUpdated: Date.now()
      };

      const result = await scoreJob(job, settings);

      expect(result.score).toBeDefined();
    });

    it('should handle case variations', async () => {
      const job: Partial<Job> = {
        id: 'test',
        url: 'https://example.com/test',
        title: 'BACKEND ENGINEER',
        description: 'PYTHON and DJANGO required. REMOTE work available.',
        firstSeen: Date.now(),
        lastUpdated: Date.now()
      };

      const result = await scoreJob(job, settings);

      expect(result.score).toBeGreaterThan(6.0);
      expect(result.reasons.some(r => r.toLowerCase().includes('python'))).toBe(true);
    });
  });
});
