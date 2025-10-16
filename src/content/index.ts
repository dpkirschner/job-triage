/**
 * Content script - Injects overlay UI into career pages
 */

import { OVERLAY, PERFORMANCE } from '@/shared/constants';
import { scanPage, type ScanResult, type ScannedJob } from './scanner';
import { normalizeJobUrl } from './scanner';
import type { Message, Job } from '@/shared/types';

// Guard against double-injection (additional safety check)
declare global {
  interface Window {
    __jobTriageContentLoaded?: boolean;
  }
}

// Check if already loaded and show overlay if it exists
if (window.__jobTriageContentLoaded) {
  console.log('[Job Triage] Content script already loaded, showing overlay');
  const existingOverlay = document.getElementById(OVERLAY.CONTAINER_ID);
  if (existingOverlay) {
    (existingOverlay as HTMLElement).style.display = 'flex';
  } else {
    console.warn('[Job Triage] Flag set but overlay not found, will re-initialize');
    window.__jobTriageContentLoaded = false;
  }
}

// Only set flag and initialize if not already loaded OR if overlay was missing
if (!window.__jobTriageContentLoaded) {
  window.__jobTriageContentLoaded = true;
  console.log('[Job Triage] Content script loaded');

/**
 * Current jobs state (for updating decisions)
 */
let currentJobs: Job[] = [];

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
    <!-- Settings Panel -->
    <div id="job-triage-settings-panel" style="margin-bottom: 16px;">
      <button id="settings-toggle" style="
        width: 100%;
        text-align: left;
        background: #f5f5f5;
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 10px 12px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <span>⚙️ Settings</span>
        <span id="settings-chevron" style="transition: transform 0.2s;">▼</span>
      </button>
      <div id="settings-content" style="
        display: none;
        padding: 12px;
        border: 1px solid #ddd;
        border-top: none;
        border-radius: 0 0 4px 4px;
        background: #fafafa;
        font-size: 13px;
      ">
        <!-- Settings form will be populated here -->
      </div>
    </div>

    <!-- Scan Button -->
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

    <!-- Results Container -->
    <div id="job-triage-results" style="color: #666; font-size: 14px;">
      <p style="margin: 0;">
        Configure your settings above, then click "Scan This Page" to find job listings.
      </p>
    </div>
  `;

  overlay.appendChild(header);
  overlay.appendChild(body);

  return overlay;
}

/**
 * Create settings form HTML
 */
function createSettingsForm(): string {
  return `
    <div style="margin-bottom: 12px;">
      <label style="display: block; margin-bottom: 4px; font-weight: 600; font-size: 12px;">
        Resume / Key Skills
      </label>
      <textarea
        id="settings-resume"
        placeholder="Paste your resume or key skills (e.g., Python, distributed systems, Kafka, AWS...)"
        style="
          width: 100%;
          min-height: 60px;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 12px;
          font-family: inherit;
          resize: vertical;
        "
      ></textarea>
    </div>

    <div style="margin-bottom: 12px;">
      <label style="display: block; margin-bottom: 4px; font-weight: 600; font-size: 12px;">
        Preferred Tech Stacks
      </label>
      <input
        type="text"
        id="settings-stacks"
        placeholder="e.g., Python, Kafka, Kubernetes, AWS"
        style="
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 12px;
        "
      />
    </div>

    <div style="margin-bottom: 12px;">
      <label style="display: block; margin-bottom: 4px; font-weight: 600; font-size: 12px;">
        Preferred Roles
      </label>
      <input
        type="text"
        id="settings-roles"
        placeholder="e.g., backend, platform, data"
        style="
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 12px;
        "
      />
    </div>

    <div style="margin-bottom: 12px;">
      <label style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 12px;">
        Work Location
      </label>
      <div style="display: flex; gap: 12px;">
        <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
          <input type="checkbox" id="settings-remote" />
          <span style="font-size: 12px;">Remote</span>
        </label>
        <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
          <input type="checkbox" id="settings-hybrid" />
          <span style="font-size: 12px;">Hybrid</span>
        </label>
        <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
          <input type="checkbox" id="settings-onsite" />
          <span style="font-size: 12px;">Onsite</span>
        </label>
      </div>
    </div>

    <div style="display: flex; gap: 8px; align-items: center;">
      <button id="save-settings-btn" style="
        padding: 8px 16px;
        background: #2196F3;
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      ">Save Settings</button>
      <span id="settings-saved-indicator" style="
        display: none;
        color: #4CAF50;
        font-size: 12px;
        font-weight: 600;
      ">✓ Saved!</span>
    </div>
  `;
}

/**
 * Toggle settings panel visibility
 */
function toggleSettingsPanel() {
  const content = document.getElementById('settings-content');
  const chevron = document.getElementById('settings-chevron');

  if (!content || !chevron) return;

  const isHidden = content.style.display === 'none';

  if (isHidden) {
    content.style.display = 'block';
    chevron.style.transform = 'rotate(180deg)';
  } else {
    content.style.display = 'none';
    chevron.style.transform = 'rotate(0deg)';
  }
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
 * Load settings from storage and populate form
 */
async function loadSettings() {
  try {
    const response = await sendMessage({ type: 'GET_SETTINGS' });

    if (response.settings) {
      const settings = response.settings;

      // Populate form fields
      const resumeEl = document.getElementById('settings-resume') as HTMLTextAreaElement;
      const stacksEl = document.getElementById('settings-stacks') as HTMLInputElement;
      const rolesEl = document.getElementById('settings-roles') as HTMLInputElement;
      const remoteEl = document.getElementById('settings-remote') as HTMLInputElement;
      const hybridEl = document.getElementById('settings-hybrid') as HTMLInputElement;
      const onsiteEl = document.getElementById('settings-onsite') as HTMLInputElement;

      if (resumeEl) resumeEl.value = settings.resume || '';
      if (stacksEl) stacksEl.value = settings.preferredStacks?.join(', ') || '';
      if (rolesEl) rolesEl.value = settings.preferredRoles?.join(', ') || '';
      if (remoteEl) remoteEl.checked = settings.locationPreferences?.remote || false;
      if (hybridEl) hybridEl.checked = settings.locationPreferences?.hybrid || false;
      if (onsiteEl) onsiteEl.checked = settings.locationPreferences?.onsite || false;

      console.log('[Content] Settings loaded successfully');
    }
  } catch (error) {
    console.error('[Content] Failed to load settings:', error);
  }
}

/**
 * Save settings to storage
 */
async function saveSettings() {
  try {
    // Get form values
    const resumeEl = document.getElementById('settings-resume') as HTMLTextAreaElement;
    const stacksEl = document.getElementById('settings-stacks') as HTMLInputElement;
    const rolesEl = document.getElementById('settings-roles') as HTMLInputElement;
    const remoteEl = document.getElementById('settings-remote') as HTMLInputElement;
    const hybridEl = document.getElementById('settings-hybrid') as HTMLInputElement;
    const onsiteEl = document.getElementById('settings-onsite') as HTMLInputElement;

    const resume = resumeEl?.value || '';
    const stacks = stacksEl?.value ? stacksEl.value.split(',').map(s => s.trim()).filter(s => s) : [];
    const roles = rolesEl?.value ? rolesEl.value.split(',').map(r => r.trim()).filter(r => r) : [];
    const remote = remoteEl?.checked || false;
    const hybrid = hybridEl?.checked || false;
    const onsite = onsiteEl?.checked || false;

    // Send to background
    await sendMessage({
      type: 'UPDATE_SETTINGS',
      settings: {
        resume,
        preferredStacks: stacks,
        preferredRoles: roles,
        locationPreferences: {
          remote,
          hybrid,
          onsite,
          cities: []
        }
      }
    });

    // Show success indicator
    const indicator = document.getElementById('settings-saved-indicator');
    if (indicator) {
      indicator.style.display = 'inline';
      setTimeout(() => {
        indicator.style.display = 'none';
      }, 2000);
    }

    console.log('[Content] Settings saved successfully');
  } catch (error) {
    console.error('[Content] Failed to save settings:', error);
    alert('Failed to save settings. Please try again.');
  }
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
 * Process jobs with concurrent fetching and scoring (cache-aware)
 */
async function processJobs(
  scannedJobs: ScannedJob[],
  onProgress?: (current: number, total: number, stage: string) => void
): Promise<Job[]> {
  const results: Job[] = [];
  const total = scannedJobs.length;

  // Step 1: Check which jobs are cached
  onProgress?.(0, total, 'checking cache');

  const urls = scannedJobs.map(j => j.url);
  const cacheCheckResponse = await sendMessage({
    type: 'CHECK_CACHED_JOBS',
    urls
  });

  const cachedUrls = new Set(cacheCheckResponse.cachedUrls || []);
  const newUrls = new Set(cacheCheckResponse.newUrls || urls);

  console.log(`[Content] Cache check: ${cachedUrls.size} cached, ${newUrls.size} new`);

  // Step 2: Load cached jobs
  if (cachedUrls.size > 0) {
    onProgress?.(0, total, 'loading cache');

    const cachedJobsResponse = await sendMessage({
      type: 'LOAD_CACHED_JOBS',
      urls: Array.from(cachedUrls)
    });

    const cachedJobs = cachedJobsResponse.jobs || [];
    results.push(...cachedJobs);

    console.log(`[Content] Loaded ${cachedJobs.length} cached jobs`);
  }

  // Step 3: Process only new jobs (not in cache)
  const newJobs = scannedJobs.filter(j => newUrls.has(j.url));

  if (newJobs.length > 0) {
    const maxConcurrent = PERFORMANCE.MAX_CONCURRENT_FETCHES;

    for (let i = 0; i < newJobs.length; i += maxConcurrent) {
      const batch = newJobs.slice(i, Math.min(i + maxConcurrent, newJobs.length));

      // Fetch job details in parallel for this batch
      const fetchPromises = batch.map(async (scannedJob, batchIndex) => {
        const jobIndex = cachedUrls.size + i + batchIndex;
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
 * Save a decision for a job
 */
async function saveDecision(jobId: string, decision: 'thumbs_up' | 'thumbs_down') {
  try {
    await sendMessage({
      type: 'SAVE_DECISION',
      jobId,
      decision
    });

    // Update current jobs state
    const job = currentJobs.find(j => j.id === jobId);
    if (job) {
      job.decision = decision;
    }

    console.log(`[Content] Decision saved for ${jobId}: ${decision}`);
  } catch (error) {
    console.error('[Content] Failed to save decision:', error);
  }
}

/**
 * Handle decision button click
 */
async function handleDecisionClick(event: Event) {
  const target = event.target as HTMLElement;
  if (!target.classList.contains('decision-btn')) return;

  const jobId = target.dataset.jobId;
  const action = target.dataset.action as 'thumbs_up' | 'thumbs_down';

  if (!jobId || !action) return;

  // Save decision
  await saveDecision(jobId, action);

  // Re-render jobs to update UI
  const atsType = currentJobs[0]?.company ? null : null; // TODO: Store ATS type
  displayScoredJobs(currentJobs, atsType);
}

/**
 * Display scored jobs in the results area
 */
function displayScoredJobs(jobs: Job[], atsType: string | null = null) {
  // Update current jobs state
  currentJobs = jobs;

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
    const hasDecision = !!job.decision;
    const isKept = job.decision === 'thumbs_up';
    const isSkipped = job.decision === 'thumbs_down';

    // Check if job was cached (has a lastUpdated time that's not recent)
    const age = Date.now() - (job.lastUpdated || Date.now());
    const isCached = age > 60000; // More than 1 minute old = cached
    const ageInHours = Math.floor(age / (1000 * 60 * 60));
    const ageInDays = Math.floor(ageInHours / 24);
    const ageText = ageInDays > 0 ? `${ageInDays}d ago` : ageInHours > 0 ? `${ageInHours}h ago` : 'just now';

    // Style based on decision
    const cardStyle = isSkipped
      ? 'opacity: 0.5; background: #f5f5f5;'
      : isKept
        ? 'background: #f1f8f4; border-left: 3px solid #4CAF50;'
        : index < 3
          ? `border-left: 3px solid ${scoreColor};`
          : '';

    return `
      <div class="job-card" data-job-id="${job.id}" style="
        margin-bottom: 12px;
        padding: 12px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 13px;
        ${cardStyle}
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
          ${isCached ? `<span style="
            background: #e3f2fd;
            color: #1976d2;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 11px;
            margin-left: 4px;
            font-weight: 500;
          " title="Loaded from cache (${ageText})">📦 Cached</span>` : ''}
          ${hasDecision ? `<span style="font-size: 16px; margin-left: 8px;">${isKept ? '👍' : '👎'}</span>` : ''}
        </div>
        ${job.location ? `<div style="color: #666; margin-bottom: 4px; font-size: 12px;">📍 ${job.location}</div>` : ''}
        ${job.company ? `<div style="color: #666; margin-bottom: 4px; font-size: 12px;">🏢 ${job.company}</div>` : ''}
        ${isCached ? `<div style="color: #999; margin-bottom: 4px; font-size: 11px;">Last updated: ${ageText}</div>` : ''}
        ${topReasons.length > 0 ? `
          <div style="margin-top: 8px; margin-bottom: 8px; font-size: 12px; color: #555;">
            ${topReasons.map(r => `<div style="margin-bottom: 2px;">${r}</div>`).join('')}
          </div>
        ` : ''}
        <div style="margin-top: 8px; display: flex; gap: 8px; align-items: center;">
          <button
            class="decision-btn"
            data-job-id="${job.id}"
            data-action="thumbs-up"
            style="
              padding: 6px 12px;
              background: ${isKept ? '#4CAF50' : '#fff'};
              color: ${isKept ? '#fff' : '#333'};
              border: 1px solid ${isKept ? '#4CAF50' : '#ddd'};
              border-radius: 4px;
              font-size: 12px;
              cursor: pointer;
              font-weight: ${isKept ? '600' : '400'};
            "
          >👍 Keep</button>
          <button
            class="decision-btn"
            data-job-id="${job.id}"
            data-action="thumbs-down"
            style="
              padding: 6px 12px;
              background: ${isSkipped ? '#9E9E9E' : '#fff'};
              color: ${isSkipped ? '#fff' : '#333'};
              border: 1px solid ${isSkipped ? '#9E9E9E' : '#ddd'};
              border-radius: 4px;
              font-size: 12px;
              cursor: pointer;
              font-weight: ${isSkipped ? '600' : '400'};
            "
          >👎 Skip</button>
          <a href="${job.url}" target="_blank" style="
            color: #1976d2;
            text-decoration: none;
            font-size: 12px;
            margin-left: auto;
          ">Open →</a>
        </div>
      </div>
    `;
  }).join('');

  // Calculate stats
  const keptCount = jobs.filter(j => j.decision === 'thumbs_up').length;
  const skippedCount = jobs.filter(j => j.decision === 'thumbs_down').length;

  resultsEl.innerHTML = `
    ${atsInfo}
    <div style="margin-bottom: 12px; font-weight: 600; color: #333;">
      Found ${jobs.length} job${jobs.length === 1 ? '' : 's'} (sorted by score)
    </div>
    ${jobsHTML}
    <div id="job-triage-footer" style="
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid #ddd;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
    ">
      <button id="open-all-kept" style="
        padding: 8px 12px;
        background: #4CAF50;
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        ${keptCount === 0 ? 'opacity: 0.5; cursor: not-allowed;' : ''}
      " ${keptCount === 0 ? 'disabled' : ''}>
        Open all 👍 (${keptCount})
      </button>
      <div style="color: #666;">
        <span style="color: #4CAF50; font-weight: 600;">Kept: ${keptCount}</span>
        <span style="margin: 0 8px;">|</span>
        <span style="color: #9E9E9E; font-weight: 600;">Skipped: ${skippedCount}</span>
      </div>
    </div>
  `;

  // Wire up "Open all 👍" button
  const openAllBtn = document.getElementById('open-all-kept');
  if (openAllBtn && keptCount > 0) {
    openAllBtn.addEventListener('click', () => {
      const keptJobs = jobs.filter(j => j.decision === 'thumbs_up');
      keptJobs.forEach(job => {
        window.open(job.url, '_blank');
      });
    });
  }
}

/**
 * Update progress during job processing
 */
function updateProgress(current: number, total: number, stage: string) {
  const resultsEl = document.getElementById('job-triage-results');
  if (!resultsEl) return;

  const stageTexts: Record<string, string> = {
    'checking cache': 'Checking cache',
    'loading cache': 'Loading cached jobs',
    'fetching': 'Fetching job details',
    'scoring': 'Scoring jobs'
  };

  const stageText = stageTexts[stage] || stage;
  const percentage = Math.round((current / total) * 100);

  const icon = stage === 'loading cache' || stage === 'checking cache' ? '📦' : '🔍';

  resultsEl.innerHTML = `
    <div style="text-align: center; color: #666;">
      <div style="margin-bottom: 12px; font-size: 18px;">${icon}</div>
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

  // Populate settings form
  const settingsContent = document.getElementById('settings-content');
  if (settingsContent) {
    settingsContent.innerHTML = createSettingsForm();
  }

  // Add settings toggle handler
  const settingsToggle = document.getElementById('settings-toggle');
  if (settingsToggle) {
    settingsToggle.addEventListener('click', toggleSettingsPanel);
  }

  // Add save settings button handler
  const saveSettingsBtn = document.getElementById('save-settings-btn');
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', saveSettings);
  }

  // Load settings into form
  loadSettings();

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

  // Add decision button handler (event delegation)
  const resultsContainer = document.getElementById('job-triage-results');
  if (resultsContainer) {
    resultsContainer.addEventListener('click', handleDecisionClick);
  }
}

// Start initialization
init();

} // End of initialization guard
