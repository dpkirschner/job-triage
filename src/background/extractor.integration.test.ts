/**
 * Integration tests using realistic HTML fixtures from real job boards
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { extractJobDetails } from './extractor';

/**
 * Load HTML fixture from file
 */
function loadFixture(filename: string): string {
  const path = join(__dirname, '__fixtures__', filename);
  return readFileSync(path, 'utf-8');
}

/**
 * Create a DOM document from HTML string
 */
function createDocument(html: string): Document {
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
}

describe('Integration Tests - Real HTML Fixtures', () => {
  describe('Greenhouse fixture', () => {
    it('extracts complete job details from realistic Greenhouse page', () => {
      const html = loadFixture('greenhouse-example.html');
      const doc = createDocument(html);
      const result = extractJobDetails('https://boards.greenhouse.io/techinnovations/jobs/123', doc);

      // Verify basic fields
      expect(result.title).toBe('Senior Full Stack Engineer');
      expect(result.company).toBe('Tech Innovations Inc.');
      expect(result.location).toBe('San Francisco, CA / Remote');
      expect(result.extractionMethod).toBe('greenhouse');

      // Verify description contains key sections
      expect(result.description).toContain('About the Role');
      expect(result.description).toContain('Responsibilities');
      expect(result.description).toContain('Requirements');

      // Verify specific content
      expect(result.description).toContain('Python and Django');
      expect(result.description).toContain('React and TypeScript');
      expect(result.description).toContain('5+ years of professional software development');

      // Verify it doesn't contain navigation or footer
      expect(result.description).not.toContain('All Jobs');
      expect(result.description).not.toContain('© 2025 Tech Innovations');
      expect(result.description).not.toContain('Apply Now');

      // Verify reasonable length
      expect(result.description.length).toBeGreaterThan(200);
      expect(result.description.length).toBeLessThanOrEqual(5000);
    });
  });

  describe('Lever fixture', () => {
    it('extracts complete job details from realistic Lever page', () => {
      const html = loadFixture('lever-example.html');
      const doc = createDocument(html);
      const result = extractJobDetails('https://jobs.lever.co/designco/product-designer', doc);

      // Verify basic fields
      expect(result.title).toBe('Product Designer');
      expect(result.company).toBe('DesignCo');
      expect(result.location).toBe('New York, NY');
      expect(result.extractionMethod).toBe('lever');

      // Verify description contains key sections
      expect(result.description).toContain('About DesignCo');
      expect(result.description).toContain("What You'll Do");
      expect(result.description).toContain("What We're Looking For");

      // Verify specific content
      expect(result.description).toContain('design tools');
      expect(result.description).toContain('user flows, wireframes');
      expect(result.description).toContain('3+ years of product design');
      expect(result.description).toContain('Figma');

      // Verify it doesn't contain navigation or footer
      expect(result.description).not.toContain('Powered by Lever');

      // Verify reasonable length
      expect(result.description.length).toBeGreaterThan(200);
      expect(result.description.length).toBeLessThanOrEqual(5000);
    });
  });

  describe('Workday fixture', () => {
    it('extracts complete job details from realistic Workday page', () => {
      const html = loadFixture('workday-example.html');
      const doc = createDocument(html);
      const result = extractJobDetails('https://globalanalytics.myworkdayjobs.com/en-US/External/job/data-scientist', doc);

      // Verify basic fields
      expect(result.title).toBe('Data Scientist');
      expect(result.location).toBe('Boston, MA, United States');
      expect(result.extractionMethod).toBe('workday');

      // Verify description contains key sections
      expect(result.description).toContain('Job Summary');
      expect(result.description).toContain('Key Responsibilities');
      expect(result.description).toContain('Required Qualifications');

      // Verify specific content
      expect(result.description).toContain('Machine Learning team');
      expect(result.description).toContain('TensorFlow, PyTorch');
      expect(result.description).toContain('PhD in Computer Science');
      expect(result.description).toContain('statistical methods');

      // Verify it doesn't contain navigation or footer
      expect(result.description).not.toContain('Careers Home');
      expect(result.description).not.toContain('Powered by Workday');

      // Verify reasonable length
      expect(result.description.length).toBeGreaterThan(200);
      expect(result.description.length).toBeLessThanOrEqual(5000);
    });
  });

  describe('Cross-platform consistency', () => {
    it('extracts structured data consistently across all platforms', () => {
      const greenhouse = loadFixture('greenhouse-example.html');
      const lever = loadFixture('lever-example.html');
      const workday = loadFixture('workday-example.html');

      const results = [
        extractJobDetails('https://boards.greenhouse.io/company/job', createDocument(greenhouse)),
        extractJobDetails('https://jobs.lever.co/company/job', createDocument(lever)),
        extractJobDetails('https://company.myworkdayjobs.com/job', createDocument(workday)),
      ];

      // All should have required fields
      for (const result of results) {
        expect(result.title).toBeDefined();
        expect(result.title.length).toBeGreaterThan(0);
        expect(result.description).toBeDefined();
        expect(result.description.length).toBeGreaterThan(100);
        expect(result.extractionMethod).toBeDefined();
      }

      // All should have clean descriptions without common noise
      for (const result of results) {
        // Should not have excessive whitespace
        expect(result.description).not.toMatch(/\s{4,}/);
        // Should not have excessive newlines
        expect(result.description).not.toMatch(/\n{4,}/);
      }
    });

    it('preserves important job details like requirements and responsibilities', () => {
      const fixtures = [
        { file: 'greenhouse-example.html', url: 'https://boards.greenhouse.io/company/job' },
        { file: 'lever-example.html', url: 'https://jobs.lever.co/company/job' },
        { file: 'workday-example.html', url: 'https://company.myworkdayjobs.com/job' },
      ];

      for (const { file, url } of fixtures) {
        const html = loadFixture(file);
        const result = extractJobDetails(url, createDocument(html));

        // Should contain years of experience (common in all fixtures)
        expect(result.description).toMatch(/\d+\+?\s*years?/i);

        // Should contain lists or bullet points (all have responsibilities/requirements)
        expect(result.description.length).toBeGreaterThan(300); // Complex content
      }
    });
  });

  describe('Performance', () => {
    it('extracts data quickly from complex pages', () => {
      const html = loadFixture('greenhouse-example.html');
      const doc = createDocument(html);

      const start = performance.now();
      extractJobDetails('https://boards.greenhouse.io/company/job', doc);
      const duration = performance.now() - start;

      // Should be fast (< 50ms for extraction, not including network)
      expect(duration).toBeLessThan(50);
    });
  });
});
