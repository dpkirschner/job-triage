/**
 * Text extraction system for job postings
 * Handles multiple ATS platforms with fallback parsing
 */

/**
 * Extracted job data
 */
export interface ExtractedJob {
  title: string;
  company?: string;
  location?: string;
  description: string;
  extractionMethod?: 'greenhouse' | 'lever' | 'workday' | 'ashby' | 'fallback';
}

/**
 * ATS platform types
 */
type ATSPlatform = 'greenhouse' | 'lever' | 'workday' | 'ashby' | 'unknown';

/**
 * Detect which ATS platform a job posting uses
 */
export function detectATS(url: string, doc: Document): ATSPlatform {
  const urlLower = url.toLowerCase();

  // URL-based detection (most reliable)
  if (urlLower.includes('greenhouse.io') || urlLower.includes('boards.greenhouse.io')) {
    return 'greenhouse';
  }
  if (urlLower.includes('lever.co') || urlLower.includes('jobs.lever.co')) {
    return 'lever';
  }
  if (urlLower.includes('myworkdayjobs.com') || urlLower.includes('workday.com')) {
    return 'workday';
  }
  if (urlLower.includes('jobs.ashbyhq.com') || urlLower.includes('ashbyhq.com')) {
    return 'ashby';
  }

  // DOM-based detection (when hosted on custom domains)
  const html = doc.documentElement.outerHTML;

  // Greenhouse signatures
  if (doc.querySelector('[data-source="greenhouse"]') ||
      doc.querySelector('.application-form') ||
      html.includes('greenhouse.io/embed')) {
    return 'greenhouse';
  }

  // Lever signatures
  if (doc.querySelector('[data-qa-lever-posting]') ||
      doc.querySelector('.posting-headline') ||
      html.includes('lever.co/embed')) {
    return 'lever';
  }

  // Workday signatures
  if (doc.querySelector('[data-automation-id]')?.getAttribute('data-automation-id')?.includes('job') ||
      html.includes('workday.com')) {
    return 'workday';
  }

  // Ashby signatures
  if (doc.querySelector('[data-ashby-application-form]') ||
      html.includes('ashbyhq.com')) {
    return 'ashby';
  }

  return 'unknown';
}

/**
 * Extract job details from a Greenhouse posting
 */
function extractGreenhouse(doc: Document): ExtractedJob | null {
  // Try multiple selector strategies (Greenhouse has variations)
  let title =
    doc.querySelector('h1.app-title')?.textContent?.trim() ||
    doc.querySelector('h1[data-qa="title"]')?.textContent?.trim() ||
    doc.querySelector('.posting-headline h2')?.textContent?.trim() ||
    doc.querySelector('h1')?.textContent?.trim();

  let company =
    doc.querySelector('.company-name')?.textContent?.trim() ||
    doc.querySelector('[data-qa="company-name"]')?.textContent?.trim();

  let location =
    doc.querySelector('.location')?.textContent?.trim() ||
    doc.querySelector('[data-qa="location"]')?.textContent?.trim();

  // Description is typically in a .content div or #content section
  let descriptionEl =
    doc.querySelector('#content') ||
    doc.querySelector('.content') ||
    doc.querySelector('#job-description') ||
    doc.querySelector('.posting-content');

  if (!descriptionEl) {
    return null;
  }

  const description = cleanText(descriptionEl.textContent || '');

  if (!title || !description) {
    return null;
  }

  return {
    title,
    company,
    location,
    description,
    extractionMethod: 'greenhouse',
  };
}

/**
 * Extract job details from a Lever posting
 */
function extractLever(doc: Document): ExtractedJob | null {
  let title =
    doc.querySelector('.posting-headline h2')?.textContent?.trim() ||
    doc.querySelector('[data-qa-lever-posting-title]')?.textContent?.trim() ||
    doc.querySelector('h2')?.textContent?.trim();

  let company =
    doc.querySelector('.main-header-text-color')?.textContent?.trim() ||
    doc.querySelector('.posting-company')?.textContent?.trim();

  let location =
    doc.querySelector('.posting-categories .location')?.textContent?.trim() ||
    doc.querySelector('[data-qa-lever-posting-location]')?.textContent?.trim();

  // Lever uses .section or .content for the description
  let descriptionEl =
    doc.querySelector('.content') ||
    doc.querySelector('.section-wrapper') ||
    doc.querySelector('.posting-description');

  if (!descriptionEl) {
    return null;
  }

  const description = cleanText(descriptionEl.textContent || '');

  if (!title || !description) {
    return null;
  }

  return {
    title,
    company,
    location,
    description,
    extractionMethod: 'lever',
  };
}

/**
 * Extract job details from a Workday posting
 */
function extractWorkday(doc: Document): ExtractedJob | null {
  let title =
    doc.querySelector('h2[data-automation-id="jobPostingHeader"]')?.textContent?.trim() ||
    doc.querySelector('[data-automation-id="jobTitle"]')?.textContent?.trim() ||
    doc.querySelector('h1')?.textContent?.trim();

  let location =
    doc.querySelector('[data-automation-id="locations"]')?.textContent?.trim() ||
    doc.querySelector('[data-automation-id="location"]')?.textContent?.trim();

  // Workday uses data-automation-id attributes
  let descriptionEl =
    doc.querySelector('[data-automation-id="jobPostingDescription"]') ||
    doc.querySelector('.JobDescription') ||
    doc.querySelector('#jobDescription');

  if (!descriptionEl) {
    return null;
  }

  const description = cleanText(descriptionEl.textContent || '');

  if (!title || !description) {
    return null;
  }

  return {
    title,
    location,
    description,
    extractionMethod: 'workday',
  };
}

/**
 * Extract job details from an Ashby posting
 */
function extractAshby(doc: Document): ExtractedJob | null {
  let title =
    doc.querySelector('h1')?.textContent?.trim() ||
    doc.querySelector('[class*="title"]')?.textContent?.trim();

  let company = doc.querySelector('[class*="company"]')?.textContent?.trim();
  let location = doc.querySelector('[class*="location"]')?.textContent?.trim();

  // Ashby typically has clean semantic HTML
  let descriptionEl =
    doc.querySelector('[data-ashby-application-form]')?.previousElementSibling ||
    doc.querySelector('article') ||
    doc.querySelector('main');

  if (!descriptionEl) {
    return null;
  }

  const description = cleanText(descriptionEl.textContent || '');

  if (!title || !description) {
    return null;
  }

  return {
    title,
    company,
    location,
    description,
    extractionMethod: 'ashby',
  };
}

/**
 * Fallback heuristic parser for unknown job boards
 * Scores elements by likelihood of being the job description
 */
function extractFallback(doc: Document): ExtractedJob | null {
  // Get title from <title> tag or first h1
  let title =
    doc.querySelector('h1')?.textContent?.trim() ||
    doc.title.split('|')[0].split('-')[0].trim();

  // Find the best candidate for job description
  const candidates = Array.from(doc.querySelectorAll('article, main, section, div, [role="main"]'));

  // Filter out navigation, headers, footers, sidebars
  const excludeSelectors = ['nav', 'header', 'footer', 'aside', '[role="navigation"]', '[role="banner"]', '[role="complementary"]'];
  const filtered = candidates.filter(el => {
    // Skip if it's or contains excluded elements
    for (const selector of excludeSelectors) {
      if (el.matches(selector) || el.closest(selector)) {
        return false;
      }
    }
    return true;
  });

  // Score each candidate
  const scored = filtered.map(el => {
    const text = el.textContent || '';
    const textLength = text.length;
    const paragraphs = el.querySelectorAll('p').length;
    const headers = el.querySelectorAll('h2, h3, h4').length;
    const lists = el.querySelectorAll('ul, ol').length;

    // Scoring heuristic
    let score = 0;
    score += Math.min(textLength / 100, 50); // Text length (cap at 50)
    score += paragraphs * 3; // Paragraphs are a good signal
    score += headers * 2; // Section headers
    score += lists * 2; // Bulleted requirements/responsibilities

    // Penalize very short or very long text
    if (textLength < 200) score *= 0.3;
    if (textLength > 20000) score *= 0.5;

    // Boost if semantic HTML
    if (el.tagName === 'ARTICLE' || el.tagName === 'MAIN') score *= 1.5;

    return { el, score, textLength };
  });

  // Sort by score and pick the best
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  if (!best || best.textLength < 200) {
    // Last resort: use body text
    const bodyText = doc.body.textContent || '';
    return {
      title,
      description: cleanText(bodyText),
      extractionMethod: 'fallback',
    };
  }

  const description = cleanText(best.el.textContent || '');

  return {
    title,
    description,
    extractionMethod: 'fallback',
  };
}

/**
 * Clean and normalize extracted text
 */
function cleanText(text: string): string {
  return text
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove excessive newlines
    .replace(/\n{3,}/g, '\n\n')
    // Trim
    .trim()
    // Limit size for storage (5000 chars as per fetcher.ts:178)
    .slice(0, 5000);
}

/**
 * Main extraction function
 * Detects ATS and uses appropriate extractor
 */
export function extractJobDetails(url: string, doc: Document): ExtractedJob {
  const ats = detectATS(url, doc);

  let result: ExtractedJob | null = null;

  // Try ATS-specific extractor
  switch (ats) {
    case 'greenhouse':
      result = extractGreenhouse(doc);
      break;
    case 'lever':
      result = extractLever(doc);
      break;
    case 'workday':
      result = extractWorkday(doc);
      break;
    case 'ashby':
      result = extractAshby(doc);
      break;
  }

  // Fallback if ATS extractor failed or unknown platform
  if (!result) {
    result = extractFallback(doc);
  }

  // Ensure we always have a title and description
  if (!result.title) {
    result.title = 'Unknown Job';
  }
  if (!result.description) {
    result.description = 'No description available';
  }

  return result;
}
