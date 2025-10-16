/**
 * Background service worker - Handles fetching, scoring, and caching
 */

import { initDatabase, SettingsStorage, JobStorage } from '@/shared/storage';
import { fetchJob } from './fetcher';
import { scoreJob } from './scorer';
import type { Message, Job, Settings } from '@/shared/types';
import { DEFAULT_SETTINGS } from '@/shared/constants';

console.log('[Job Triage] Background service worker initialized');

/**
 * Initialize database on service worker startup
 */
initDatabase()
  .then(() => {
    console.log('[Job Triage] Database initialized successfully');
  })
  .catch((error) => {
    console.error('[Job Triage] Database initialization failed:', error);
  });

/**
 * Handle messages from content script
 */
chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  console.log('[Job Triage] Received message:', message);

  switch (message.type) {
    case 'FETCH_JOB':
      handleFetchJob(message.url).then(sendResponse);
      return true; // Async response

    case 'COMPUTE_SCORE':
      handleComputeScore(message.job).then(sendResponse);
      return true; // Async response

    case 'GET_SETTINGS':
      handleGetSettings().then(sendResponse);
      return true; // Async response

    case 'UPDATE_SETTINGS':
      handleUpdateSettings(message.settings).then(sendResponse);
      return true; // Async response

    case 'SAVE_DECISION':
      handleSaveDecision(message.jobId, message.decision).then(sendResponse);
      return true; // Async response

    case 'CHECK_CACHED_JOBS':
      handleCheckCachedJobs(message.urls).then(sendResponse);
      return true; // Async response

    case 'LOAD_CACHED_JOBS':
      handleLoadCachedJobs(message.urls).then(sendResponse);
      return true; // Async response

    default:
      console.warn('[Job Triage] Unknown message type:', message);
      sendResponse({ error: 'Unknown message type' });
      return false;
  }
});

/**
 * Fetch job details from URL using the robust fetcher
 */
async function handleFetchJob(url: string) {
  console.log(`[Job Triage] Fetching job from: ${url}`);

  const result = await fetchJob(url);

  if (result.success) {
    return {
      type: 'FETCH_JOB_RESPONSE',
      job: result.job,
      fromCache: result.fromCache,
      fetchedAt: result.fetchedAt,
    };
  } else {
    console.error('[Job Triage] Fetch error:', result.error);
    return {
      type: 'FETCH_JOB_RESPONSE',
      error: result.error,
    };
  }
}

/**
 * Compute score for a job using the scoring engine
 */
async function handleComputeScore(job: Partial<Job>) {
  try {
    // Load settings from storage
    let settings = await SettingsStorage.get();

    // Use defaults if no settings found
    if (!settings) {
      console.warn('[Job Triage] No settings found, using defaults');
      settings = DEFAULT_SETTINGS;
    }

    // Score the job
    const result = await scoreJob(job, settings);

    // Update job with score and save
    if (job.id) {
      const existingJob = await JobStorage.get(job.id);
      if (existingJob) {
        const updatedJob: Job = {
          ...existingJob,
          score: result.score,
          reasons: result.reasons,
          lastUpdated: Date.now()
        };
        await JobStorage.save(updatedJob);
      }
    }

    return {
      type: 'COMPUTE_SCORE_RESPONSE',
      score: result.score,
      reasons: result.reasons,
    };
  } catch (error) {
    console.error('[Job Triage] Scoring error:', error);
    return {
      type: 'COMPUTE_SCORE_RESPONSE',
      error: error instanceof Error ? error.message : 'Scoring failed',
      score: 0,
      reasons: ['⚠ Scoring failed']
    };
  }
}

/**
 * Get user settings from storage
 */
async function handleGetSettings() {
  try {
    let settings = await SettingsStorage.get();

    // Return defaults if no settings found
    if (!settings) {
      settings = DEFAULT_SETTINGS;
    }

    return {
      type: 'GET_SETTINGS_RESPONSE',
      settings,
    };
  } catch (error) {
    console.error('[Job Triage] Error loading settings:', error);
    return {
      type: 'GET_SETTINGS_RESPONSE',
      settings: DEFAULT_SETTINGS,
      error: 'Failed to load settings'
    };
  }
}

/**
 * Update user settings in storage
 */
async function handleUpdateSettings(settings: Partial<Settings>) {
  try {
    // Load existing settings
    let currentSettings = await SettingsStorage.get();

    // Merge with defaults if no existing settings
    if (!currentSettings) {
      currentSettings = DEFAULT_SETTINGS;
    }

    // Merge new settings with existing
    const updatedSettings: Settings = {
      ...currentSettings,
      ...settings
    };

    // Save to storage
    await SettingsStorage.save(updatedSettings);

    console.log('[Job Triage] Settings updated successfully');
    return { success: true };
  } catch (error) {
    console.error('[Job Triage] Error updating settings:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update settings'
    };
  }
}

/**
 * Save user decision for a job
 */
async function handleSaveDecision(jobId: string, decision: 'thumbs_up' | 'thumbs_down') {
  try {
    // Load existing job
    const job = await JobStorage.get(jobId);

    if (!job) {
      console.error(`[Job Triage] Job not found: ${jobId}`);
      return {
        success: false,
        error: 'Job not found'
      };
    }

    // Update job with decision
    const updatedJob: Job = {
      ...job,
      decision,
      lastUpdated: Date.now()
    };

    // Save updated job
    await JobStorage.save(updatedJob);

    console.log(`[Job Triage] Decision saved for ${jobId}:`, decision);
    return { success: true };
  } catch (error) {
    console.error(`[Job Triage] Error saving decision:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save decision'
    };
  }
}

/**
 * Check which URLs are cached and which are new
 */
async function handleCheckCachedJobs(urls: string[]) {
  try {
    const cachedUrls: string[] = [];
    const newUrls: string[] = [];

    // Check each URL to see if it exists in storage
    for (const url of urls) {
      const exists = await JobStorage.exists(url);
      if (exists) {
        cachedUrls.push(url);
      } else {
        newUrls.push(url);
      }
    }

    console.log(`[Job Triage] Cache check: ${cachedUrls.length} cached, ${newUrls.length} new`);

    return {
      type: 'CHECK_CACHED_JOBS_RESPONSE',
      cachedUrls,
      newUrls,
    };
  } catch (error) {
    console.error('[Job Triage] Error checking cached jobs:', error);
    return {
      type: 'CHECK_CACHED_JOBS_RESPONSE',
      cachedUrls: [],
      newUrls: urls, // Treat all as new on error
      error: error instanceof Error ? error.message : 'Failed to check cache'
    };
  }
}

/**
 * Load cached jobs by URLs
 */
async function handleLoadCachedJobs(urls: string[]) {
  try {
    const jobs = await JobStorage.getByUrls(urls);

    console.log(`[Job Triage] Loaded ${jobs.length} cached jobs`);

    return {
      type: 'LOAD_CACHED_JOBS_RESPONSE',
      jobs,
    };
  } catch (error) {
    console.error('[Job Triage] Error loading cached jobs:', error);
    return {
      type: 'LOAD_CACHED_JOBS_RESPONSE',
      jobs: [],
      error: error instanceof Error ? error.message : 'Failed to load cached jobs'
    };
  }
}

/**
 * Handle extension icon click - inject content script into current tab
 */
chrome.action.onClicked.addListener(async (tab) => {
  console.log('[Job Triage] Extension icon clicked on tab:', tab.id);

  if (!tab.id) {
    console.error('[Job Triage] No tab ID available');
    return;
  }

  try {
    // Check if already injected
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => (window as any).__jobTriageContentLoaded === true
    });

    if (results[0]?.result === true) {
      console.log('[Job Triage] Already initialized on this tab, re-injecting to show overlay');
      // Fall through to inject again - the content script will handle showing the overlay
    }

    // Inject the content script files into isolated world
    // This gives access to chrome.* APIs
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/index.js']
    });

    console.log('[Job Triage] Content script injected successfully');
  } catch (error) {
    console.error('[Job Triage] Failed to inject content script:', error);

    // If injection fails, fall back to opening settings
    chrome.runtime.openOptionsPage();
  }
});
