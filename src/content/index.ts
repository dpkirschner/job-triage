/**
 * Content script - Injects overlay UI into career pages
 */

import { OVERLAY, PERFORMANCE } from '@/shared/constants';
import { scanPage, type ScanResult, type ScannedJob } from './scanner';
import { normalizeJobUrl } from './scanner';
import type { Message, Job } from '@/shared/types';

console.log('[Job Triage] Content script loaded');

/**
 * Check if overlay already exists
 */
function overlayExists(): boolean {
  return !!document.getElementById(OVERLAY.CONTAINER_ID);
}

/**
 * Create and inject overlay container
 */
function createOverlay(): HTMLElement {
  const overlay = document.createElement('div');
  overlay.id = OVERLAY.CONTAINER_ID;
  overlay.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    width: 400px;
    max-height: 80vh;
    background: white;
    border: 2px solid #333;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: ${OVERLAY.Z_INDEX};
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  `;

  // Header
  const header = document.createElement('div');
  header.style.cssText = `
    padding: 16px;
    background: #f5f5f5;
    border-bottom: 1px solid #ddd;
    font-weight: 600;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;
  header.innerHTML = `
    <span>Job Triage</span>
    <button id="job-triage-close" style="
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      padding: 4px 8px;
    ">&times;</button>
  `;

  // Body
  const body = document.createElement('div');
  body.id = 'job-triage-body';
  body.style.cssText = `
    padding: 16px;
    overflow-y: auto;
    flex: 1;
  `;
  body.innerHTML = `
    <div style="margin-bottom: 16px;">
      <button id="job-triage-scan-btn" style="
        width: 100%;
        padding: 12px;
        background: #4CAF50;
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
      ">Scan This Page</button>
    </div>
    <div id="job-triage-results" style="color: #666; font-size: 14px;">
      <p style="margin: 0;">
        Click "Scan This Page" to find job listings on this page.
      </p>
    </div>
  `;

  overlay.appendChild(header);
  overlay.appendChild(body);

  return overlay;
}

/**
 * Send message to background and wait for response
 */
function sendMessage<T extends Message>(message: T): Promise<any> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, resolve);
  });
}

/**
 * Fetch job details (description) from background worker
 */
async function fetchJobDetails(url: string): Promise<Partial<Job> | null> {
  try {
    const response = await sendMessage({
      type: 'FETCH_JOB',
      url
    });

    if (response.error) {
      console.error(`[Content] Fetch error for ${url}:`, response.error);
      return null;
    }

    return response.job;
  } catch (error) {
    console.error(`[Content] Failed to fetch ${url}:`, error);
    return null;
  }
}

/**
 * Compute score for a job using background scorer
 */
async function computeScore(job: Partial<Job>): Promise<{ score: number; reasons: string[] } | null> {
  try {
    const response = await sendMessage({
      type: 'COMPUTE_SCORE',
      job
    });

    if (response.error) {
      console.error('[Content] Scoring error:', response.error);
      return { score: 0, reasons: ['⚠ Scoring failed'] };
    }

    return {
      score: response.score,
      reasons: response.reasons
    };
  } catch (error) {
    console.error('[Content] Failed to score job:', error);
    return { score: 0, reasons: ['⚠ Scoring failed'] };
  }
}

/**
 * Process jobs with concurrent fetching and scoring
 */
async function processJobs(
  scannedJobs: ScannedJob[],
  onProgress?: (current: number, total: number, stage: string) => void
): Promise<Job[]> {
  const results: Job[] = [];
  const total = scannedJobs.length;

  // Process jobs with concurrency limit
  const maxConcurrent = PERFORMANCE.MAX_CONCURRENT_FETCHES;

  for (let i = 0; i < scannedJobs.length; i += maxConcurrent) {
    const batch = scannedJobs.slice(i, Math.min(i + maxConcurrent, scannedJobs.length));

    // Fetch job details in parallel for this batch
    const fetchPromises = batch.map(async (scannedJob, batchIndex) => {
      const jobIndex = i + batchIndex;
      onProgress?.(jobIndex + 1, total, 'fetching');

      const jobDetails = await fetchJobDetails(scannedJob.url);

      if (!jobDetails || !jobDetails.description) {
        // Return job without description (won't be scored)
        return {
          id: normalizeJobUrl(scannedJob.url),
          url: scannedJob.url,
          title: scannedJob.title,
          location: scannedJob.location,
          company: scannedJob.company,
          description: '',
          score: 0,
          reasons: ['⚠ Description unavailable'],
          firstSeen: Date.now(),
          lastUpdated: Date.now()
        } as Job;
      }

      // Score the job
      onProgress?.(jobIndex + 1, total, 'scoring');

      const scoreResult = await computeScore({
        ...jobDetails,
        title: scannedJob.title,
        location: scannedJob.location,
        company: scannedJob.company
      });

      // Create full job object
      const job: Job = {
        id: normalizeJobUrl(scannedJob.url),
        url: scannedJob.url,
        title: scannedJob.title,
        location: scannedJob.location,
        company: scannedJob.company,
        description: jobDetails.description || '',
        score: scoreResult?.score || 0,
        reasons: scoreResult?.reasons || ['⚠ Scoring failed'],
        firstSeen: Date.now(),
        lastUpdated: Date.now()
      };

      return job;
    });

    const batchResults = await Promise.all(fetchPromises);
    results.push(...batchResults);
  }

  // Sort by score descending
  return results.sort((a, b) => (b.score || 0) - (a.score || 0));
}

/**
 * Get score color based on score value
 */
function getScoreColor(score: number): string {
  if (score >= 7.0) return '#4CAF50'; // Green
  if (score >= 5.0) return '#FF9800'; // Orange
  return '#9E9E9E'; // Gray
}

/**
 * Display scored jobs in the results area
 */
function displayScoredJobs(jobs: Job[], atsType: string | null = null) {
  const resultsEl = document.getElementById('job-triage-results');
  if (!resultsEl) return;

  // Show ATS type if detected
  const atsInfo = atsType
    ? `<div style="margin-bottom: 12px; padding: 8px; background: #e8f5e9; border-radius: 4px; font-size: 13px;">
         Detected: <strong>${atsType}</strong>
       </div>`
    : '';

  // No jobs found
  if (jobs.length === 0) {
    resultsEl.innerHTML = `
      ${atsInfo}
      <p style="margin: 0; color: #999;">
        No job listings found on this page. Try a different page or check the URL.
      </p>
    `;
    return;
  }

  // Display jobs (already sorted by score)
  const jobsHTML = jobs.map((job, index) => {
    const scoreColor = getScoreColor(job.score || 0);
    const topReasons = (job.reasons || []).slice(0, 2);

    return `
      <div style="
        margin-bottom: 12px;
        padding: 12px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 13px;
        ${index < 3 ? 'border-left: 3px solid ' + scoreColor + ';' : ''}
      ">
        <div style="display: flex; align-items: center; margin-bottom: 4px;">
          <div style="
            background: ${scoreColor};
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: 700;
            font-size: 14px;
            margin-right: 8px;
          ">${(job.score || 0).toFixed(1)}</div>
          <div style="font-weight: 600; flex: 1;">${job.title}</div>
        </div>
        ${job.location ? `<div style="color: #666; margin-bottom: 4px; font-size: 12px;">📍 ${job.location}</div>` : ''}
        ${job.company ? `<div style="color: #666; margin-bottom: 4px; font-size: 12px;">🏢 ${job.company}</div>` : ''}
        ${topReasons.length > 0 ? `
          <div style="margin-top: 8px; margin-bottom: 8px; font-size: 12px; color: #555;">
            ${topReasons.map(r => `<div style="margin-bottom: 2px;">${r}</div>`).join('')}
          </div>
        ` : ''}
        <a href="${job.url}" target="_blank" style="color: #1976d2; text-decoration: none; font-size: 12px;">
          View Job →
        </a>
      </div>
    `;
  }).join('');

  resultsEl.innerHTML = `
    ${atsInfo}
    <div style="margin-bottom: 12px; font-weight: 600; color: #333;">
      Found ${jobs.length} job${jobs.length === 1 ? '' : 's'} (sorted by score)
    </div>
    ${jobsHTML}
  `;
}

/**
 * Update progress during job processing
 */
function updateProgress(current: number, total: number, stage: string) {
  const resultsEl = document.getElementById('job-triage-results');
  if (!resultsEl) return;

  const stageText = stage === 'fetching' ? 'Fetching job details' : 'Scoring jobs';
  const percentage = Math.round((current / total) * 100);

  resultsEl.innerHTML = `
    <div style="text-align: center; color: #666;">
      <div style="margin-bottom: 12px; font-size: 18px;">🔍</div>
      <div style="font-weight: 600; margin-bottom: 8px;">${stageText}...</div>
      <div style="margin-bottom: 12px; color: #999; font-size: 13px;">
        ${current} / ${total} (${percentage}%)
      </div>
      <div style="width: 100%; height: 6px; background: #eee; border-radius: 3px; overflow: hidden;">
        <div style="width: ${percentage}%; height: 100%; background: #4CAF50; transition: width 0.3s ease;"></div>
      </div>
    </div>
  `;
}

/**
 * Handle scan button click
 */
async function handleScan() {
  const scanBtn = document.getElementById('job-triage-scan-btn') as HTMLButtonElement;
  const resultsEl = document.getElementById('job-triage-results');

  if (!scanBtn || !resultsEl) return;

  // Show loading state
  scanBtn.disabled = true;
  scanBtn.textContent = 'Scanning...';
  scanBtn.style.background = '#9E9E9E';

  resultsEl.innerHTML = `
    <div style="text-align: center; color: #666;">
      <div style="margin-bottom: 8px;">🔍</div>
      <div>Scanning page for job listings...</div>
    </div>
  `;

  try {
    // Step 1: Scan page for jobs
    const scanResult = scanPage();

    if (scanResult.foundCount === 0 || scanResult.errors.length > 0) {
      // Show scan errors or empty state
      resultsEl.innerHTML = `
        ${scanResult.errors.length > 0 ? `
          <div style="margin-bottom: 12px; padding: 8px; background: #fff3cd; border-radius: 4px; font-size: 13px; color: #856404;">
            ${scanResult.errors.join('<br>')}
          </div>
        ` : ''}
        <p style="margin: 0; color: #999;">
          No job listings found on this page. Try a different page or check the URL.
        </p>
      `;
      return;
    }

    console.log(`[Content] Scanned ${scanResult.foundCount} jobs, fetching details and scoring...`);

    // Step 2: Fetch job details and score jobs
    const scoredJobs = await processJobs(scanResult.jobs, updateProgress);

    // Step 3: Display scored jobs
    displayScoredJobs(scoredJobs, scanResult.atsType);

    console.log(`[Content] Successfully processed ${scoredJobs.length} jobs`);

  } catch (error) {
    console.error('[Content] Scan error:', error);
    resultsEl.innerHTML = `
      <div style="padding: 12px; background: #ffebee; border-radius: 4px; color: #c62828;">
        <strong>Error:</strong> ${error instanceof Error ? error.message : 'Failed to scan page'}
      </div>
    `;
  } finally {
    // Reset button
    scanBtn.disabled = false;
    scanBtn.textContent = 'Scan This Page';
    scanBtn.style.background = '#4CAF50';
  }
}

/**
 * Initialize content script
 */
function init() {
  // Don't inject if overlay already exists
  if (overlayExists()) {
    console.log('[Job Triage] Overlay already exists, skipping injection');
    return;
  }

  // Wait for page to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
    return;
  }

  console.log('[Job Triage] Injecting overlay');
  const overlay = createOverlay();
  document.body.appendChild(overlay);

  // Add close button handler
  const closeBtn = document.getElementById('job-triage-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      overlay.style.display = 'none';
    });
  }

  // Add scan button handler
  const scanBtn = document.getElementById('job-triage-scan-btn');
  if (scanBtn) {
    scanBtn.addEventListener('click', handleScan);
  }
}

// Start initialization
init();
