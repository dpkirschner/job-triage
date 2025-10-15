/**
 * Tests for page scanner
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { detectATS, scanPage, normalizeJobUrl, type ScanResult } from './scanner';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load HTML fixtures
const loadFixture = (filename: string): string => {
  const path = join(__dirname, '__fixtures__', filename);
  return readFileSync(path, 'utf-8');
};

describe('scanner', () => {
  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('detectATS', () => {
    it('should detect Greenhouse by URL pattern', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://boards.greenhouse.io/techcorp' },
        writable: true
      });

      const atsType = detectATS();
      expect(atsType).toBe('greenhouse');
    });

    it('should detect Lever by URL pattern', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://jobs.lever.co/company' },
        writable: true
      });

      const atsType = detectATS();
      expect(atsType).toBe('lever');
    });

    it('should detect Ashby by URL pattern', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://jobs.ashbyhq.com/company' },
        writable: true
      });

      const atsType = detectATS();
      expect(atsType).toBe('ashby');
    });

    it('should detect Greenhouse by DOM marker', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://example.com/careers' },
        writable: true
      });

      document.body.innerHTML = '<div data-source="greenhouse"></div>';

      const atsType = detectATS();
      expect(atsType).toBe('greenhouse');
    });

    it('should detect Lever by DOM marker', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://example.com/careers' },
        writable: true
      });

      document.body.innerHTML = '<div data-qa-lever-posting="true"></div>';

      const atsType = detectATS();
      expect(atsType).toBe('lever');
    });

    it('should detect Workday by data-automation-id', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://example.com/careers' },
        writable: true
      });

      document.body.innerHTML = '<div data-automation-id="jobCard"></div>';

      const atsType = detectATS();
      expect(atsType).toBe('workday');
    });

    it('should return null for unknown ATS', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://example.com/careers' },
        writable: true
      });

      document.body.innerHTML = '<div class="job-listing"></div>';

      const atsType = detectATS();
      expect(atsType).toBeNull();
    });
  });

  describe('normalizeJobUrl', () => {
    it('should remove tracking parameters', () => {
      const url = 'https://example.com/job/123?utm_source=linkedin&utm_medium=social&ref=external';
      const normalized = normalizeJobUrl(url);

      expect(normalized).toBe('https://example.com/job/123');
    });

    it('should convert relative URLs to absolute', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://example.com/careers' },
        writable: true
      });

      const url = '/job/123';
      const normalized = normalizeJobUrl(url);

      expect(normalized).toBe('https://example.com/job/123');
    });

    it('should preserve important query parameters', () => {
      const url = 'https://example.com/job/123?id=456&category=engineering';
      const normalized = normalizeJobUrl(url);

      expect(normalized).toContain('id=456');
      expect(normalized).toContain('category=engineering');
    });

    it('should handle URLs with fragments', () => {
      const url = 'https://example.com/job/123#section';
      const normalized = normalizeJobUrl(url);

      expect(normalized).toBe('https://example.com/job/123#section');
    });

    it('should treat ambiguous paths as relative URLs', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://example.com/careers' },
        writable: true
      });

      const url = 'not-a-url';
      const normalized = normalizeJobUrl(url);

      // URL parser treats this as relative, not malformed
      expect(normalized).toBe('https://example.com/not-a-url');
    });

    it('should remove multiple tracking parameters', () => {
      const url = 'https://example.com/job/123?utm_campaign=hiring&gh_jid=abc&gh_src=def&normal_param=keep';
      const normalized = normalizeJobUrl(url);

      expect(normalized).not.toContain('utm_campaign');
      expect(normalized).not.toContain('gh_jid');
      expect(normalized).not.toContain('gh_src');
      expect(normalized).toContain('normal_param=keep');
    });
  });

  describe('scanPage - Greenhouse', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://boards.greenhouse.io/techcorp' },
        writable: true
      });

      const html = loadFixture('greenhouse-listings.html');
      document.body.innerHTML = html;
    });

    it('should detect Greenhouse ATS', () => {
      const result = scanPage();
      expect(result.atsType).toBe('greenhouse');
    });

    it('should extract all jobs from Greenhouse page', () => {
      const result = scanPage();
      expect(result.foundCount).toBe(5);
      expect(result.jobs).toHaveLength(5);
    });

    it('should extract job titles correctly', () => {
      const result = scanPage();
      const titles = result.jobs.map(j => j.title);

      expect(titles).toContain('Senior Backend Engineer');
      expect(titles).toContain('Platform Engineer');
      expect(titles).toContain('Frontend Engineer');
      expect(titles).toContain('DevOps Engineer');
      expect(titles).toContain('Data Engineer');
    });

    it('should extract job URLs correctly', () => {
      const result = scanPage();
      const urls = result.jobs.map(j => j.url);

      expect(urls).toContain('https://techcorp.com/jobs/123/senior-backend-engineer');
      expect(urls).toContain('https://techcorp.com/jobs/125/frontend-engineer');
    });

    it('should extract location information', () => {
      const result = scanPage();
      const backendJob = result.jobs.find(j => j.title === 'Senior Backend Engineer');

      expect(backendJob?.location).toContain('San Francisco');
    });

    it('should normalize URLs by removing tracking params', () => {
      const result = scanPage();
      const platformJob = result.jobs.find(j => j.title === 'Platform Engineer');

      // Should remove utm_source and ref params
      expect(platformJob?.url).not.toContain('utm_source');
      expect(platformJob?.url).not.toContain('ref=');
      expect(platformJob?.url).toBe('https://techcorp.com/jobs/124/platform-engineer');
    });

    it('should have no errors for valid Greenhouse page', () => {
      const result = scanPage();
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('scanPage - Lever', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://jobs.lever.co/designco' },
        writable: true
      });

      const html = loadFixture('lever-listings.html');
      document.body.innerHTML = html;
    });

    it('should detect Lever ATS', () => {
      const result = scanPage();
      expect(result.atsType).toBe('lever');
    });

    it('should extract all jobs from Lever page', () => {
      const result = scanPage();
      expect(result.foundCount).toBe(4);
      expect(result.jobs).toHaveLength(4);
    });

    it('should extract job titles correctly', () => {
      const result = scanPage();
      const titles = result.jobs.map(j => j.title);

      expect(titles).toContain('Product Designer');
      expect(titles).toContain('Senior UX Researcher');
      expect(titles).toContain('Design Systems Engineer');
      expect(titles).toContain('Brand Designer');
    });

    it('should extract job URLs correctly', () => {
      const result = scanPage();
      const urls = result.jobs.map(j => j.url);

      expect(urls.some(url => url.includes('product-designer'))).toBe(true);
      expect(urls.some(url => url.includes('senior-ux-researcher'))).toBe(true);
    });

    it('should extract location information', () => {
      const result = scanPage();
      const designerJob = result.jobs.find(j => j.title === 'Product Designer');

      expect(designerJob?.location).toBe('New York, NY');
    });

    it('should remove tracking params from Lever URLs', () => {
      const result = scanPage();
      const systemsJob = result.jobs.find(j => j.title === 'Design Systems Engineer');

      expect(systemsJob?.url).not.toContain('utm_campaign');
    });
  });

  describe('scanPage - Workday', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://megacorp.wd1.myworkdayjobs.com/en-US/Careers' },
        writable: true
      });

      const html = loadFixture('workday-listings.html');
      document.body.innerHTML = html;
    });

    it('should detect Workday ATS', () => {
      const result = scanPage();
      expect(result.atsType).toBe('workday');
    });

    it('should extract all jobs from Workday page', () => {
      const result = scanPage();
      expect(result.foundCount).toBe(5);
      expect(result.jobs).toHaveLength(5);
    });

    it('should extract job titles correctly', () => {
      const result = scanPage();
      const titles = result.jobs.map(j => j.title);

      expect(titles).toContain('Software Engineer II');
      expect(titles).toContain('Staff Software Engineer');
      expect(titles).toContain('Product Manager');
      expect(titles).toContain('Technical Program Manager');
      expect(titles).toContain('Data Scientist');
    });

    it('should extract job URLs correctly', () => {
      const result = scanPage();
      const urls = result.jobs.map(j => j.url);

      expect(urls.some(url => url.includes('Software-Engineer-II'))).toBe(true);
      expect(urls.some(url => url.includes('Data-Scientist'))).toBe(true);
    });

    it('should extract location information', () => {
      const result = scanPage();
      const softwareJob = result.jobs.find(j => j.title === 'Software Engineer II');

      expect(softwareJob?.location).toBe('Seattle, WA');
    });
  });

  describe('scanPage - Generic', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://startupco.com/careers' },
        writable: true
      });

      const html = loadFixture('generic-listings.html');
      document.body.innerHTML = html;
    });

    it('should use generic fallback for unknown ATS', () => {
      const result = scanPage();
      expect(result.atsType).toBeNull();
    });

    it('should extract jobs using generic selectors', () => {
      const result = scanPage();
      expect(result.foundCount).toBeGreaterThan(0);
      expect(result.jobs.length).toBeGreaterThan(0);
    });

    it('should extract job titles from generic cards', () => {
      const result = scanPage();
      const titles = result.jobs.map(j => j.title);

      expect(titles.some(title => title.includes('Backend Engineer'))).toBe(true);
      expect(titles.some(title => title.includes('Frontend Developer'))).toBe(true);
    });

    it('should handle relative URLs', () => {
      const result = scanPage();
      const urls = result.jobs.map(j => j.url);

      // All URLs should be absolute
      urls.forEach(url => {
        expect(url).toMatch(/^https?:\/\//);
      });
    });

    it('should not pick up non-job links', () => {
      const result = scanPage();
      const urls = result.jobs.map(j => j.url);

      // Should not include About, Contact, Blog links
      expect(urls.some(url => url.includes('/about'))).toBe(false);
      expect(urls.some(url => url.includes('/contact'))).toBe(false);
      expect(urls.some(url => url.includes('/blog'))).toBe(false);
    });
  });

  describe('scanPage - Deduplication', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://example.com/careers' },
        writable: true
      });
    });

    it('should deduplicate jobs with same URL', () => {
      document.body.innerHTML = `
        <div>
          <a href="/job/123">Engineer</a>
          <a href="/job/123?ref=email">Engineer</a>
          <a href="/job/123?utm_source=linkedin">Engineer</a>
        </div>
      `;

      const result = scanPage();

      // All three should normalize to same URL, so only 1 job
      expect(result.foundCount).toBe(1);
    });

    it('should keep jobs with different URLs', () => {
      document.body.innerHTML = `
        <div>
          <a href="/job/123">Engineer 1</a>
          <a href="/job/456">Engineer 2</a>
          <a href="/job/789">Engineer 3</a>
        </div>
      `;

      const result = scanPage();
      expect(result.foundCount).toBe(3);
    });
  });

  describe('scanPage - Error Handling', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://example.com/careers' },
        writable: true
      });
    });

    it('should handle empty page gracefully', () => {
      document.body.innerHTML = '<div></div>';

      const result = scanPage();
      expect(result.foundCount).toBe(0);
      expect(result.jobs).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle page with no job cards', () => {
      document.body.innerHTML = `
        <div class="content">
          <h1>Careers</h1>
          <p>We're hiring! Check back soon.</p>
        </div>
      `;

      const result = scanPage();
      expect(result.foundCount).toBe(0);
      expect(result.errors).toContain('No job cards found on this page');
    });

    it('should handle malformed job cards', () => {
      document.body.innerHTML = `
        <div class="opening">
          <!-- Missing link -->
          <span>Some Job</span>
        </div>
        <div class="opening">
          <a href="/job/123">Valid Job</a>
        </div>
      `;

      Object.defineProperty(window, 'location', {
        value: { href: 'https://boards.greenhouse.io/test' },
        writable: true
      });

      const result = scanPage();

      // Should extract only the valid job
      expect(result.foundCount).toBe(1);
      expect(result.jobs[0].title).toBe('Valid Job');
    });

    it('should return empty array instead of throwing on error', () => {
      document.body.innerHTML = '<div class="opening"></div>';

      // Should not throw
      expect(() => scanPage()).not.toThrow();

      const result = scanPage();
      expect(result.jobs).toEqual([]);
    });
  });

  describe('scanPage - Edge Cases', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://example.com/careers' },
        writable: true
      });
    });

    it('should handle job cards with extra whitespace', () => {
      document.body.innerHTML = `
        <div class="opening">
          <a href="/job/123">

              Senior Engineer

          </a>
        </div>
      `;

      Object.defineProperty(window, 'location', {
        value: { href: 'https://boards.greenhouse.io/test' },
        writable: true
      });

      const result = scanPage();
      expect(result.jobs[0].title).toBe('Senior Engineer');
    });

    it('should handle job cards with nested elements', () => {
      document.body.innerHTML = `
        <div class="opening">
          <a href="/job/123">
            <span><strong>Backend</strong> Engineer</span>
          </a>
        </div>
      `;

      Object.defineProperty(window, 'location', {
        value: { href: 'https://boards.greenhouse.io/test' },
        writable: true
      });

      const result = scanPage();
      expect(result.jobs[0].title).toContain('Backend');
      expect(result.jobs[0].title).toContain('Engineer');
    });

    it('should handle URLs with special characters', () => {
      document.body.innerHTML = `
        <a href="/job/c%2B%2B-engineer">C++ Engineer</a>
      `;

      const result = scanPage();
      expect(result.jobs[0].url).toContain('c%2B%2B-engineer');
    });

    it('should handle very long job titles', () => {
      const longTitle = 'A'.repeat(500);
      document.body.innerHTML = `
        <a href="/job/123">${longTitle}</a>
      `;

      const result = scanPage();
      expect(result.jobs[0].title).toHaveLength(500);
    });
  });
});
