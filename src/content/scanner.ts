/**
 * Page scanner - Detects and extracts job cards from careers listing pages
 *
 * Supports multiple ATS platforms:
 * - Greenhouse
 * - Lever
 * - Ashby
 * - Workday
 * - Generic fallback
 */

import { ATS_PATTERNS } from '@/shared/constants';

/**
 * Scanned job from listing page
 */
export interface ScannedJob {
  /** Job posting URL (normalized) */
  url: string;
  /** Job title */
  title: string;
  /** Location (if available on listing page) */
  location?: string;
  /** Company name (if available on listing page) */
  company?: string;
}

/**
 * Result of scanning a page
 */
export interface ScanResult {
  /** Jobs found on the page */
  jobs: ScannedJob[];
  /** Detected ATS type (null for generic) */
  atsType: string | null;
  /** Number of jobs found */
  foundCount: number;
  /** Errors encountered during scanning */
  errors: string[];
}

/**
 * Selector configuration for an ATS platform
 */
interface ATSSelectors {
  /** Selector for job card container */
  jobCard: string;
  /** Selector for job title (relative to job card) */
  title: string;
  /** Selector for job link (relative to job card) */
  link: string;
  /** Selector for location (relative to job card, optional) */
  location?: string;
  /** Selector for company (relative to job card, optional) */
  company?: string;
}

/**
 * ATS-specific selector configurations
 */
const ATS_SELECTORS: Record<string, ATSSelectors> = {
  greenhouse: {
    jobCard: '.opening',
    title: 'a',
    link: 'a',
    location: '.location',
  },
  lever: {
    jobCard: '.posting',
    title: '.posting-title h5, .posting-title a, h5',
    link: '.posting-title a, a.posting-btn-submit',
    location: '.posting-categories .location, .location',
  },
  ashby: {
    jobCard: '[data-job-id], .ashby-job-posting-brief',
    title: 'a, h3',
    link: 'a',
    location: '.ashby-job-posting-location, [data-qa="location"]',
  },
  workday: {
    jobCard: 'li[data-automation-id="jobCard"], li[data-automation-id="listItem"]',
    title: 'h3 a, [data-automation-id="jobTitle"]',
    link: 'a[data-automation-id="jobTitle"], h3 a',
    location: '[data-automation-id="location"], .css-location',
  },
  // Generic fallback for unknown ATS
  generic: {
    jobCard: 'a[href*="/job"], a[href*="/position"], a[href*="/career"], .job-listing, .job-card, .position',
    title: 'text',
    link: 'href',
  }
};

/**
 * Detect which ATS platform the current page uses
 *
 * @returns ATS type identifier or null for generic fallback
 */
export function detectATS(): string | null {
  // Check URL patterns first (most reliable)
  const url = window.location.href;

  if (ATS_PATTERNS.greenhouse.test(url)) {
    return 'greenhouse';
  }

  if (ATS_PATTERNS.lever.test(url)) {
    return 'lever';
  }

  if (ATS_PATTERNS.ashby.test(url)) {
    return 'ashby';
  }

  if (ATS_PATTERNS.workable.test(url)) {
    return 'workable';
  }

  // Check DOM for ATS-specific markers

  // Greenhouse markers
  if (
    document.querySelector('[data-source="greenhouse"]') ||
    document.querySelector('.greenhouse-board') ||
    document.querySelector('#greenhouse-app')
  ) {
    return 'greenhouse';
  }

  // Lever markers
  if (
    document.querySelector('[data-qa-lever-posting]') ||
    document.querySelector('[data-qa-lever]') ||
    document.querySelector('.lever-jobs-embed')
  ) {
    return 'lever';
  }

  // Ashby markers
  if (
    document.querySelector('[data-job-id]') ||
    document.querySelector('.ashby-job-board')
  ) {
    return 'ashby';
  }

  // Workday markers (strong indicator is data-automation-id attributes)
  if (
    document.querySelector('[data-automation-id="jobCard"]') ||
    document.querySelector('[data-automation-id="jobTitle"]')
  ) {
    return 'workday';
  }

  // No ATS detected - will use generic fallback
  return null;
}

/**
 * Normalize job URL for deduplication
 * Removes tracking parameters and makes URL absolute
 *
 * @param url - URL to normalize
 * @returns Normalized absolute URL
 */
export function normalizeJobUrl(url: string): string {
  try {
    // Make URL absolute if relative
    const urlObj = new URL(url, window.location.href);

    // Remove tracking parameters
    const paramsToRemove = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
      'ref', 'source', 'referrer', 'campaign',
      'gh_jid', 'gh_src'  // Greenhouse-specific
    ];

    paramsToRemove.forEach(param => {
      urlObj.searchParams.delete(param);
    });

    return urlObj.toString();
  } catch (error) {
    // If URL parsing fails, return original
    console.warn('[Scanner] Failed to normalize URL:', url, error);
    return url;
  }
}

/**
 * Extract job information from a single job card element
 *
 * @param card - Job card DOM element
 * @param selectors - ATS-specific selectors
 * @returns Scanned job or null if extraction failed
 */
function extractJobCard(card: Element, selectors: ATSSelectors): ScannedJob | null {
  try {
    // Extract link
    let linkEl: HTMLAnchorElement | null = null;

    if (selectors.link === 'href') {
      // Card itself is a link
      linkEl = card as HTMLAnchorElement;
    } else {
      // Find link within card
      linkEl = card.querySelector(selectors.link);
    }

    if (!linkEl || !linkEl.href) {
      return null;
    }

    // Extract title
    let title = '';

    if (selectors.title === 'text') {
      // Use card's text content
      title = card.textContent?.trim() || '';
    } else {
      // Find title element
      const titleEl = card.querySelector(selectors.title);
      title = titleEl?.textContent?.trim() || '';
    }

    if (!title) {
      return null;
    }

    // Normalize URL
    const url = normalizeJobUrl(linkEl.href);

    // Extract optional fields
    const location = selectors.location
      ? card.querySelector(selectors.location)?.textContent?.trim()
      : undefined;

    const company = selectors.company
      ? card.querySelector(selectors.company)?.textContent?.trim()
      : undefined;

    return {
      url,
      title,
      location,
      company
    };
  } catch (error) {
    console.warn('[Scanner] Failed to extract job card:', error);
    return null;
  }
}

/**
 * Scan the current page for job listings
 *
 * @returns Scan result with jobs, ATS type, and errors
 */
export function scanPage(): ScanResult {
  const errors: string[] = [];
  const jobs: ScannedJob[] = [];

  try {
    // Detect ATS
    const atsType = detectATS();
    const selectors = atsType ? ATS_SELECTORS[atsType] : ATS_SELECTORS.generic;

    console.log('[Scanner] Detected ATS:', atsType || 'generic');
    console.log('[Scanner] Using selectors:', selectors);

    // Find all job cards
    const cards = document.querySelectorAll(selectors.jobCard);

    console.log('[Scanner] Found', cards.length, 'potential job cards');

    if (cards.length === 0) {
      errors.push('No job cards found on this page');
      return {
        jobs: [],
        atsType,
        foundCount: 0,
        errors
      };
    }

    // Extract job from each card
    const seenUrls = new Set<string>();

    for (const card of cards) {
      const job = extractJobCard(card, selectors);

      if (job) {
        // Deduplicate by URL
        if (!seenUrls.has(job.url)) {
          jobs.push(job);
          seenUrls.add(job.url);
        }
      }
    }

    if (jobs.length === 0) {
      errors.push(`Found ${cards.length} job cards but couldn't extract details`);
    }

    console.log('[Scanner] Successfully extracted', jobs.length, 'jobs');

    return {
      jobs,
      atsType,
      foundCount: jobs.length,
      errors
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during scan';
    console.error('[Scanner] Scan error:', error);
    errors.push(errorMessage);

    return {
      jobs,
      atsType: null,
      foundCount: 0,
      errors
    };
  }
}
