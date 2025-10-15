/**
 * Tests for job text extraction system
 */

import { describe, it, expect } from 'vitest';
import { detectATS, extractJobDetails, type ExtractedJob } from './extractor';

/**
 * Helper to create a DOM document from HTML string
 */
function createDocument(html: string): Document {
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
}

describe('detectATS', () => {
  it('detects Greenhouse from URL', () => {
    const doc = createDocument('<html><body></body></html>');
    expect(detectATS('https://boards.greenhouse.io/company/jobs/123', doc)).toBe('greenhouse');
    expect(detectATS('https://jobs.greenhouse.io/company/123', doc)).toBe('greenhouse');
  });

  it('detects Lever from URL', () => {
    const doc = createDocument('<html><body></body></html>');
    expect(detectATS('https://jobs.lever.co/company/job-id', doc)).toBe('lever');
    expect(detectATS('https://lever.co/company/job-id', doc)).toBe('lever');
  });

  it('detects Workday from URL', () => {
    const doc = createDocument('<html><body></body></html>');
    expect(detectATS('https://company.wd1.myworkdayjobs.com/en-US/External/job/123', doc)).toBe('workday');
    expect(detectATS('https://workday.com/company/job', doc)).toBe('workday');
  });

  it('detects Ashby from URL', () => {
    const doc = createDocument('<html><body></body></html>');
    expect(detectATS('https://jobs.ashbyhq.com/company', doc)).toBe('ashby');
  });

  it('detects Greenhouse from DOM when hosted on custom domain', () => {
    const html = `
      <html>
        <body>
          <div data-source="greenhouse"></div>
          <div class="application-form"></div>
        </body>
      </html>
    `;
    const doc = createDocument(html);
    expect(detectATS('https://careers.company.com/job/123', doc)).toBe('greenhouse');
  });

  it('detects Lever from DOM when hosted on custom domain', () => {
    const html = `
      <html>
        <body>
          <div data-qa-lever-posting="true">
            <div class="posting-headline">Job Title</div>
          </div>
        </body>
      </html>
    `;
    const doc = createDocument(html);
    expect(detectATS('https://careers.company.com/job', doc)).toBe('lever');
  });

  it('returns unknown for unrecognized platforms', () => {
    const doc = createDocument('<html><body><h1>Job Title</h1></body></html>');
    expect(detectATS('https://company.com/jobs/123', doc)).toBe('unknown');
  });
});

describe('extractJobDetails - Greenhouse', () => {
  it('extracts job details from standard Greenhouse page', () => {
    const html = `
      <html>
        <body>
          <h1 class="app-title">Senior Software Engineer</h1>
          <div class="company-name">Tech Company</div>
          <div class="location">San Francisco, CA</div>
          <div id="content">
            <p>We are looking for a senior software engineer to join our team.</p>
            <h3>Responsibilities</h3>
            <ul>
              <li>Build scalable systems</li>
              <li>Mentor junior engineers</li>
            </ul>
            <h3>Requirements</h3>
            <ul>
              <li>5+ years experience</li>
              <li>Strong Python skills</li>
            </ul>
          </div>
        </body>
      </html>
    `;
    const doc = createDocument(html);
    const result = extractJobDetails('https://boards.greenhouse.io/company/jobs/123', doc);

    expect(result.title).toBe('Senior Software Engineer');
    expect(result.company).toBe('Tech Company');
    expect(result.location).toBe('San Francisco, CA');
    expect(result.description).toContain('senior software engineer');
    expect(result.description).toContain('Responsibilities');
    expect(result.description).toContain('Build scalable systems');
    expect(result.extractionMethod).toBe('greenhouse');
  });

  it('extracts job with data-qa attributes', () => {
    const html = `
      <html>
        <body>
          <h1 data-qa="title">Frontend Developer</h1>
          <div data-qa="company-name">StartupCo</div>
          <div data-qa="location">Remote</div>
          <div class="content">
            <p>Join our frontend team building amazing user experiences.</p>
          </div>
        </body>
      </html>
    `;
    const doc = createDocument(html);
    const result = extractJobDetails('https://greenhouse.io/company/job', doc);

    expect(result.title).toBe('Frontend Developer');
    expect(result.company).toBe('StartupCo');
    expect(result.location).toBe('Remote');
    expect(result.description).toContain('frontend team');
  });
});

describe('extractJobDetails - Lever', () => {
  it('extracts job details from Lever page', () => {
    const html = `
      <html>
        <body>
          <div class="posting-headline">
            <h2>Product Manager</h2>
          </div>
          <div class="posting-company">ProductCo</div>
          <div class="posting-categories">
            <div class="location">New York, NY</div>
          </div>
          <div class="content">
            <div class="section">
              <h3>About the Role</h3>
              <p>We're seeking a product manager to drive our product vision.</p>
            </div>
            <div class="section">
              <h3>What You'll Do</h3>
              <ul>
                <li>Define product roadmap</li>
                <li>Work with engineering teams</li>
              </ul>
            </div>
          </div>
        </body>
      </html>
    `;
    const doc = createDocument(html);
    const result = extractJobDetails('https://jobs.lever.co/company/product-manager', doc);

    expect(result.title).toBe('Product Manager');
    expect(result.company).toBe('ProductCo');
    expect(result.location).toBe('New York, NY');
    expect(result.description).toContain('product vision');
    expect(result.description).toContain('Define product roadmap');
    expect(result.extractionMethod).toBe('lever');
  });
});

describe('extractJobDetails - Workday', () => {
  it('extracts job details from Workday page', () => {
    const html = `
      <html>
        <body>
          <h2 data-automation-id="jobPostingHeader">Data Scientist</h2>
          <div data-automation-id="locations">Boston, MA</div>
          <div data-automation-id="jobPostingDescription">
            <p>Join our data science team to build ML models at scale.</p>
            <h4>Qualifications</h4>
            <ul>
              <li>PhD in Computer Science or related field</li>
              <li>Experience with TensorFlow/PyTorch</li>
            </ul>
          </div>
        </body>
      </html>
    `;
    const doc = createDocument(html);
    const result = extractJobDetails('https://company.myworkdayjobs.com/en-US/job/123', doc);

    expect(result.title).toBe('Data Scientist');
    expect(result.location).toBe('Boston, MA');
    expect(result.description).toContain('data science team');
    expect(result.description).toContain('TensorFlow/PyTorch');
    expect(result.extractionMethod).toBe('workday');
  });
});

describe('extractJobDetails - Ashby', () => {
  it('extracts job details from Ashby page', () => {
    const html = `
      <html>
        <body>
          <h1>Backend Engineer</h1>
          <article>
            <p>We're building the future of HR tech and need talented backend engineers.</p>
            <h3>What we're looking for</h3>
            <ul>
              <li>Strong Go or Rust experience</li>
              <li>Distributed systems knowledge</li>
            </ul>
          </article>
          <div data-ashby-application-form></div>
        </body>
      </html>
    `;
    const doc = createDocument(html);
    const result = extractJobDetails('https://jobs.ashbyhq.com/company/backend-engineer', doc);

    expect(result.title).toBe('Backend Engineer');
    expect(result.description).toContain('HR tech');
    expect(result.description).toContain('Distributed systems');
    expect(result.extractionMethod).toBe('ashby');
  });
});

describe('extractJobDetails - Fallback parser', () => {
  it('extracts from unknown job board using heuristics', () => {
    const html = `
      <html>
        <head><title>DevOps Engineer - Acme Corp</title></head>
        <body>
          <header>
            <nav>Home | Jobs | About</nav>
          </header>
          <main>
            <h1>DevOps Engineer</h1>
            <article>
              <p>Acme Corp is hiring a DevOps Engineer to manage our cloud infrastructure.</p>
              <h2>Responsibilities</h2>
              <ul>
                <li>Manage Kubernetes clusters</li>
                <li>Implement CI/CD pipelines</li>
                <li>Monitor system performance</li>
              </ul>
              <h2>Requirements</h2>
              <ul>
                <li>3+ years DevOps experience</li>
                <li>AWS/GCP expertise</li>
              </ul>
            </article>
          </main>
          <footer>© 2025 Acme Corp</footer>
        </body>
      </html>
    `;
    const doc = createDocument(html);
    const result = extractJobDetails('https://acmecorp.com/careers/devops', doc);

    expect(result.title).toBe('DevOps Engineer');
    expect(result.description).toContain('cloud infrastructure');
    expect(result.description).toContain('Kubernetes clusters');
    expect(result.extractionMethod).toBe('fallback');
    // Should not include navigation or footer text
    expect(result.description).not.toContain('Home | Jobs | About');
    expect(result.description).not.toContain('© 2025');
  });

  it('handles minimal job pages', () => {
    const html = `
      <html>
        <head><title>Job Opening</title></head>
        <body>
          <h1>Software Engineer</h1>
          <div>
            <p>We need a software engineer. Apply now!</p>
          </div>
        </body>
      </html>
    `;
    const doc = createDocument(html);
    const result = extractJobDetails('https://example.com/job', doc);

    expect(result.title).toBe('Software Engineer');
    expect(result.description).toContain('software engineer');
    expect(result.extractionMethod).toBe('fallback');
  });

  it('prefers semantic HTML elements (article, main)', () => {
    const html = `
      <html>
        <body>
          <h1>QA Engineer</h1>
          <div>
            <p>Short snippet in a div</p>
          </div>
          <article>
            <p>This is a much longer and more detailed job description in an article tag.</p>
            <p>It has multiple paragraphs and detailed information about the role.</p>
            <h3>What you'll do</h3>
            <ul>
              <li>Write test automation</li>
              <li>Ensure quality</li>
            </ul>
          </article>
        </body>
      </html>
    `;
    const doc = createDocument(html);
    const result = extractJobDetails('https://example.com/qa', doc);

    expect(result.description).toContain('article tag');
    expect(result.description).toContain('test automation');
    expect(result.description).not.toContain('Short snippet in a div');
  });
});

describe('extractJobDetails - Edge cases', () => {
  it('handles missing title gracefully', () => {
    const html = '<html><body><p>A job description without a title.</p></body></html>';
    const doc = createDocument(html);
    const result = extractJobDetails('https://example.com/job', doc);

    expect(result.title).toBe('Unknown Job');
    expect(result.description).toContain('job description');
  });

  it('handles missing description gracefully', () => {
    const html = '<html><body><h1>Job Title</h1></body></html>';
    const doc = createDocument(html);
    const result = extractJobDetails('https://example.com/job', doc);

    expect(result.title).toBe('Job Title');
    expect(result.description).toBeDefined();
    expect(result.description.length).toBeGreaterThan(0);
  });

  it('handles completely empty document', () => {
    const html = '<html><body></body></html>';
    const doc = createDocument(html);
    const result = extractJobDetails('https://example.com/job', doc);

    expect(result.title).toBe('Unknown Job');
    expect(result.description).toBe('No description available');
  });

  it('cleans whitespace and limits description length', () => {
    const longText = 'A'.repeat(10000);
    const html = `
      <html>
        <body>
          <h1>Job</h1>
          <article>
            <p>${longText}</p>
          </article>
        </body>
      </html>
    `;
    const doc = createDocument(html);
    const result = extractJobDetails('https://example.com/job', doc);

    // Should be limited to 5000 chars
    expect(result.description.length).toBeLessThanOrEqual(5000);
  });

  it('normalizes excessive whitespace', () => {
    const html = `
      <html>
        <body>
          <h1>Job Title</h1>
          <article>
            <p>This    has    multiple    spaces</p>



            <p>And multiple newlines</p>
          </article>
        </body>
      </html>
    `;
    const doc = createDocument(html);
    const result = extractJobDetails('https://example.com/job', doc);

    // Should normalize multiple spaces to single space
    expect(result.description).not.toContain('    ');
    // Should not have excessive newlines
    expect(result.description).not.toContain('\n\n\n');
  });

  it('handles missing optional fields (company, location)', () => {
    const html = `
      <html>
        <body>
          <h1 class="app-title">Engineer</h1>
          <div id="content">
            <p>Job description without company or location.</p>
          </div>
        </body>
      </html>
    `;
    const doc = createDocument(html);
    const result = extractJobDetails('https://greenhouse.io/company/job', doc);

    expect(result.title).toBe('Engineer');
    expect(result.company).toBeUndefined();
    expect(result.location).toBeUndefined();
    expect(result.description).toContain('Job description');
  });
});

describe('extractJobDetails - ATS extractor fallback', () => {
  it('falls back to heuristic parser when Greenhouse selectors fail', () => {
    const html = `
      <html>
        <body>
          <!-- Greenhouse URL but non-standard structure -->
          <h1>Unusual Structure</h1>
          <section>
            <p>This Greenhouse page doesn't use standard selectors.</p>
            <p>But it still has content we can extract.</p>
          </section>
        </body>
      </html>
    `;
    const doc = createDocument(html);
    const result = extractJobDetails('https://boards.greenhouse.io/company/job', doc);

    // Should still extract something using fallback
    expect(result.title).toBe('Unusual Structure');
    expect(result.description).toContain('standard selectors');
    expect(result.extractionMethod).toBe('fallback');
  });

  it('falls back when Lever selectors are missing', () => {
    const html = `
      <html>
        <head><title>Job at Lever Company - Careers</title></head>
        <body>
          <h1>Job at Lever Company</h1>
          <div>
            <p>This is a Lever job but with non-standard HTML.</p>
          </div>
        </body>
      </html>
    `;
    const doc = createDocument(html);
    const result = extractJobDetails('https://jobs.lever.co/company/job', doc);

    expect(result.title).toBe('Job at Lever Company');
    expect(result.description).toContain('non-standard HTML');
    expect(result.extractionMethod).toBe('fallback');
  });
});
