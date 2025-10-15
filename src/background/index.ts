/**
 * Background service worker - Handles fetching, scoring, and caching
 */

import { initDatabase } from '@/shared/storage';
import { fetchJob } from './fetcher';
import type { Message } from '@/shared/types';

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
 * Compute score for a job (placeholder)
 */
async function handleComputeScore(job: any) {
  // Placeholder scoring - will be enhanced in later phases
  const score = Math.random() * 10;
  const reasons = ['Keyword match found', 'Location preference matched'];

  return {
    type: 'COMPUTE_SCORE_RESPONSE',
    score,
    reasons,
  };
}

/**
 * Get user settings (placeholder)
 */
async function handleGetSettings() {
  // Will be implemented with storage layer
  return {
    type: 'GET_SETTINGS_RESPONSE',
    settings: {
      resume: '',
      preferredStacks: [],
      preferredRoles: [],
      locationPreferences: {
        remote: true,
        hybrid: true,
        onsite: false,
      },
      scoringWeights: {
        similarity: 0.6,
        keyword: 0.2,
        role: 0.1,
        location: 0.1,
      },
      scoreThreshold: 7.0,
    },
  };
}

/**
 * Update settings (placeholder)
 */
async function handleUpdateSettings(settings: any) {
  console.log('[Job Triage] Updating settings:', settings);
  return { success: true };
}

/**
 * Save user decision (placeholder)
 */
async function handleSaveDecision(jobId: string, decision: 'thumbs_up' | 'thumbs_down') {
  console.log(`[Job Triage] Saving decision for ${jobId}:`, decision);
  return { success: true };
}

/**
 * Handle extension icon click
 */
chrome.action.onClicked.addListener((tab) => {
  console.log('[Job Triage] Extension icon clicked');
  chrome.runtime.openOptionsPage();
});
