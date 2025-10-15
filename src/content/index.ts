/**
 * Content script - Injects overlay UI into career pages
 */

import { OVERLAY } from '@/shared/constants';
import { scanPage, type ScanResult } from './scanner';

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
 * Update the results area with scan results
 */
function displayResults(result: ScanResult) {
  const resultsEl = document.getElementById('job-triage-results');
  if (!resultsEl) return;

  // Show ATS type if detected
  const atsInfo = result.atsType
    ? `<div style="margin-bottom: 12px; padding: 8px; background: #e8f5e9; border-radius: 4px; font-size: 13px;">
         Detected: <strong>${result.atsType}</strong>
       </div>`
    : '';

  // Show errors if any
  const errorsInfo = result.errors.length > 0
    ? `<div style="margin-bottom: 12px; padding: 8px; background: #fff3cd; border-radius: 4px; font-size: 13px; color: #856404;">
         ${result.errors.join('<br>')}
       </div>`
    : '';

  // No jobs found
  if (result.foundCount === 0) {
    resultsEl.innerHTML = `
      ${atsInfo}
      ${errorsInfo}
      <p style="margin: 0; color: #999;">
        No job listings found on this page. Try a different page or check the URL.
      </p>
    `;
    return;
  }

  // Display jobs
  const jobsHTML = result.jobs.map((job, index) => `
    <div style="
      margin-bottom: 12px;
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 13px;
    ">
      <div style="font-weight: 600; margin-bottom: 4px;">${index + 1}. ${job.title}</div>
      ${job.location ? `<div style="color: #666; margin-bottom: 4px;">📍 ${job.location}</div>` : ''}
      ${job.company ? `<div style="color: #666; margin-bottom: 8px;">🏢 ${job.company}</div>` : ''}
      <a href="${job.url}" target="_blank" style="color: #1976d2; text-decoration: none; font-size: 12px;">
        View Job →
      </a>
    </div>
  `).join('');

  resultsEl.innerHTML = `
    ${atsInfo}
    ${errorsInfo}
    <div style="margin-bottom: 12px; font-weight: 600; color: #333;">
      Found ${result.foundCount} job${result.foundCount === 1 ? '' : 's'}
    </div>
    ${jobsHTML}
  `;
}

/**
 * Handle scan button click
 */
function handleScan() {
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

  // Run scanner (use setTimeout to allow UI to update)
  setTimeout(() => {
    try {
      const result = scanPage();
      displayResults(result);
    } catch (error) {
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
  }, 100);
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
