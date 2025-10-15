/**
 * Tests for job fetcher module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchJob, getFetchQueueStatus } from './fetcher';
import { JobStorage } from '@/shared/storage';
import { createMockJob } from '@/__tests__/mocks';

// Mock JobStorage
vi.mock('@/shared/storage', () => ({
  JobStorage: {
    get: vi.fn(),
    save: vi.fn(),
  },
}));

// Mock fetch globally
global.fetch = vi.fn();

describe('fetchJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Cache behavior', () => {
    it('should return cached job if cache is valid', async () => {
      const cachedJob = createMockJob({
        id: 'https://example.com/job/123',
        url: 'https://example.com/job/123',
        lastUpdated: Date.now(),
      });

      (JobStorage.get as any).mockResolvedValue(cachedJob);

      const resultPromise = fetchJob('https://example.com/job/123');
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.fromCache).toBe(true);
      expect(result.job?.id).toBe(cachedJob.id);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should fetch if cache is expired', async () => {
      const expiredJob = createMockJob({
        id: 'https://example.com/job/123',
        lastUpdated: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 days old (expired)
      });

      (JobStorage.get as any).mockResolvedValue(expiredJob);
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<html><title>Job Title</title><body>Description</body></html>'),
      });

      const resultPromise = fetchJob('https://example.com/job/123');
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.fromCache).toBeUndefined();
      expect(fetch).toHaveBeenCalled();
    });

    it('should fetch if no cache exists', async () => {
      (JobStorage.get as any).mockResolvedValue(null);
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<html><title>New Job</title><body>Fresh content</body></html>'),
      });

      const resultPromise = fetchJob('https://example.com/job/456');
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        'https://example.com/job/456',
        expect.objectContaining({
          headers: expect.any(Object),
        })
      );
    });
  });

  describe('HTTP error handling', () => {
    it('should return error for 404 responses', async () => {
      (JobStorage.get as any).mockResolvedValue(null);
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const resultPromise = fetchJob('https://example.com/job/404');
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('404');
    });

    it('should retry on 500 server errors', async () => {
      (JobStorage.get as any).mockResolvedValue(null);

      // First two attempts fail with 500
      (global.fetch as any)
        .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Server Error' })
        .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Server Error' })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('<html><title>Success</title></html>'),
        });

      const resultPromise = fetchJob('https://example.com/job/retry');

      // Run timers to allow retries
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(fetch).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(true);
    });

    it('should fail after max retries on server errors', async () => {
      (JobStorage.get as any).mockResolvedValue(null);
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });

      const resultPromise = fetchJob('https://example.com/job/fail');
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(fetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
      expect(result.success).toBe(false);
      expect(result.error).toContain('503');
    });
  });

  describe('URL normalization', () => {
    it('should normalize URLs by removing tracking params', async () => {
      const cachedJob = createMockJob({
        id: 'https://example.com/job/123',
        lastUpdated: Date.now(),
      });

      (JobStorage.get as any).mockResolvedValue(cachedJob);

      const urlWithTracking = 'https://example.com/job/123?utm_source=linkedin&ref=external';
      const resultPromise = fetchJob(urlWithTracking);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.fromCache).toBe(true);
      // Should have checked for normalized URL
      expect(JobStorage.get).toHaveBeenCalledWith('https://example.com/job/123');
    });
  });

  describe('HTML parsing', () => {
    it('should extract title and description from HTML', async () => {
      (JobStorage.get as any).mockResolvedValue(null);
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<html><title>Senior Engineer</title><body>Great opportunity...</body></html>'),
      });

      const resultPromise = fetchJob('https://example.com/job/parse');
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.job?.title).toBe('Senior Engineer');
      expect(result.job?.description).toContain('Great opportunity');
    });

    it('should limit description to 5000 characters', async () => {
      (JobStorage.get as any).mockResolvedValue(null);
      const longText = 'a'.repeat(10000);
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(`<html><title>Job</title><body>${longText}</body></html>`),
      });

      const resultPromise = fetchJob('https://example.com/job/long');
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.job?.description?.length).toBeLessThanOrEqual(5000);
    });
  });

  describe('Error scenarios', () => {
    it('should handle CORS errors', async () => {
      (JobStorage.get as any).mockResolvedValue(null);
      (global.fetch as any).mockRejectedValue(new Error('CORS policy blocked'));

      const resultPromise = fetchJob('https://example.com/job/cors');
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('CORS');
    });

    it('should handle network errors with retry', async () => {
      (JobStorage.get as any).mockResolvedValue(null);

      // Fail twice, succeed on third
      (global.fetch as any)
        .mockRejectedValueOnce(new Error('Failed to fetch'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('<html><title>Success</title></html>'),
        });

      const resultPromise = fetchJob('https://example.com/job/network');
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(fetch).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(true);
    });
  });

  describe('Cache saving', () => {
    it('should save fetched job to cache', async () => {
      (JobStorage.get as any).mockResolvedValue(null);
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<html><title>Cached Job</title><body>Content</body></html>'),
      });

      const resultPromise = fetchJob('https://example.com/job/save');
      await vi.runAllTimersAsync();
      await resultPromise;

      expect(JobStorage.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'https://example.com/job/save',
          title: 'Cached Job',
        })
      );
    });
  });
});

describe('getFetchQueueStatus', () => {
  it('should return queue status', () => {
    const status = getFetchQueueStatus();

    expect(status).toHaveProperty('inFlight');
    expect(status).toHaveProperty('queued');
    expect(status).toHaveProperty('total');
    expect(typeof status.inFlight).toBe('number');
  });
});
