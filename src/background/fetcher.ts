/**
 * Job fetcher with concurrency control, caching, and retry logic
 */

import { JobStorage } from '@/shared/storage';
import { PERFORMANCE, CACHE } from '@/shared/constants';
import type { Job } from '@/shared/types';

/**
 * Result of a fetch operation
 */
export interface FetchResult {
  success: boolean;
  job?: Partial<Job>;
  error?: string;
  fromCache?: boolean;
  fetchedAt?: number;
}

/**
 * Queued fetch request
 */
interface QueuedFetch {
  url: string;
  resolve: (result: FetchResult) => void;
  reject: (error: Error) => void;
}

/**
 * Fetch queue for concurrency control
 */
class FetchQueue {
  private queue: QueuedFetch[] = [];
  private inFlight = 0;
  private readonly maxConcurrent: number;

  constructor(maxConcurrent: number = PERFORMANCE.MAX_CONCURRENT_FETCHES) {
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * Add a fetch request to the queue
   */
  async enqueue(url: string): Promise<FetchResult> {
    return new Promise((resolve, reject) => {
      this.queue.push({ url, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Process queued requests respecting concurrency limit
   */
  private async processQueue() {
    if (this.inFlight >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const request = this.queue.shift();
    if (!request) return;

    this.inFlight++;

    try {
      const result = await fetchJobWithRetry(request.url);
      request.resolve(result);
    } catch (error) {
      request.reject(error as Error);
    } finally {
      this.inFlight--;
      this.processQueue(); // Process next in queue
    }
  }

  /**
   * Get current queue status
   */
  getStatus() {
    return {
      inFlight: this.inFlight,
      queued: this.queue.length,
      total: this.inFlight + this.queue.length,
    };
  }
}

// Global fetch queue instance
const fetchQueue = new FetchQueue();

/**
 * Fetch a job with timeout
 */
async function fetchWithTimeout(url: string, timeoutMs: number = PERFORMANCE.FETCH_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      // Add headers to mimic a real browser request
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; JobTriageExtension/0.1.0)',
      },
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if ((error as Error).name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

/**
 * Fetch a job with retry logic
 */
async function fetchJobWithRetry(
  url: string,
  maxRetries: number = 2,
  attempt: number = 0
): Promise<FetchResult> {
  try {
    // Check cache first
    const normalizedUrl = normalizeJobUrl(url);
    const cached = await JobStorage.get(normalizedUrl);

    if (cached && isCacheValid(cached)) {
      console.log(`[Fetcher] Cache hit for ${url}`);
      return {
        success: true,
        job: cached,
        fromCache: true,
      };
    }

    console.log(`[Fetcher] Fetching ${url} (attempt ${attempt + 1}/${maxRetries + 1})`);

    // Fetch with timeout
    const response = await fetchWithTimeout(url);

    // Handle HTTP errors
    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: false,
          error: 'Job posting not found (404)',
        };
      }

      // Retry on server errors (5xx)
      if (response.status >= 500 && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s
        console.log(`[Fetcher] Server error ${response.status}, retrying in ${delay}ms`);
        await sleep(delay);
        return fetchJobWithRetry(url, maxRetries, attempt + 1);
      }

      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    // Parse HTML
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const title = doc.querySelector('title')?.textContent?.trim() || 'Unknown Job';
    const description = doc.body.textContent?.trim() || '';

    const job: Partial<Job> = {
      id: normalizedUrl,
      url: normalizedUrl,
      title,
      description: description.slice(0, 5000), // Limit size
      firstSeen: Date.now(),
      lastUpdated: Date.now(),
    };

    // Cache the result
    await JobStorage.save(job as Job);

    return {
      success: true,
      job,
      fetchedAt: Date.now(),
    };
  } catch (error) {
    const errorMessage = (error as Error).message;

    // Detect CORS errors
    if (errorMessage.includes('CORS') || errorMessage.includes('blocked')) {
      return {
        success: false,
        error: 'CORS policy blocked request. The job board may not allow cross-origin requests.',
      };
    }

    // Retry on network errors
    if (attempt < maxRetries && isRetryableError(error as Error)) {
      const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
      console.log(`[Fetcher] Network error, retrying in ${delay}ms`);
      await sleep(delay);
      return fetchJobWithRetry(url, maxRetries, attempt + 1);
    }

    return {
      success: false,
      error: errorMessage || 'Unknown error occurred',
    };
  }
}

/**
 * Normalize job URL for consistent caching
 */
function normalizeJobUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove tracking parameters
    parsed.searchParams.delete('utm_source');
    parsed.searchParams.delete('utm_medium');
    parsed.searchParams.delete('utm_campaign');
    parsed.searchParams.delete('ref');
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Check if cached job is still valid
 */
function isCacheValid(job: Partial<Job>): boolean {
  if (!job.lastUpdated) return false;
  const age = Date.now() - job.lastUpdated;
  return age < CACHE.JOB_TTL;
}

/**
 * Check if error is retryable (network errors, not client errors)
 */
function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('failed to fetch') ||
    message.includes('connection')
  );
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Public API: Fetch a job (queued with concurrency control)
 */
export async function fetchJob(url: string): Promise<FetchResult> {
  return fetchQueue.enqueue(url);
}

/**
 * Get fetch queue status
 */
export function getFetchQueueStatus() {
  return fetchQueue.getStatus();
}
