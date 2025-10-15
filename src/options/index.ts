/**
 * Options page - Settings UI logic
 */

import { SettingsStorage } from '@/shared/storage';
import { DEFAULT_SETTINGS } from '@/shared/constants';
import type { Settings } from '@/shared/types';

console.log('[Job Triage] Options page loaded');

// Get DOM elements
const resumeTextarea = document.getElementById('resume') as HTMLTextAreaElement;
const stacksInput = document.getElementById('stacks') as HTMLInputElement;
const rolesInput = document.getElementById('roles') as HTMLInputElement;
const thresholdInput = document.getElementById('threshold') as HTMLInputElement;
const saveButton = document.getElementById('save') as HTMLButtonElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;

/**
 * Load settings from storage and populate form
 */
async function loadSettings() {
  try {
    const settings = await SettingsStorage.get();
    const effectiveSettings = settings || DEFAULT_SETTINGS;

    resumeTextarea.value = effectiveSettings.resume;
    stacksInput.value = effectiveSettings.preferredStacks.join(', ');
    rolesInput.value = effectiveSettings.preferredRoles.join(', ');
    thresholdInput.value = effectiveSettings.scoreThreshold.toString();

    console.log('[Job Triage] Settings loaded:', effectiveSettings);
  } catch (error) {
    console.error('[Job Triage] Error loading settings:', error);
    showStatus('Failed to load settings', 'error');
  }
}

/**
 * Save settings to storage
 */
async function saveSettings() {
  try {
    const settings: Settings = {
      resume: resumeTextarea.value.trim(),
      preferredStacks: stacksInput.value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      preferredRoles: rolesInput.value
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean),
      locationPreferences: { ...DEFAULT_SETTINGS.locationPreferences },
      scoringWeights: { ...DEFAULT_SETTINGS.scoringWeights },
      scoreThreshold: parseFloat(thresholdInput.value) || DEFAULT_SETTINGS.scoreThreshold,
    };

    await SettingsStorage.save(settings);
    console.log('[Job Triage] Settings saved:', settings);
    showStatus('Settings saved successfully!', 'success');
  } catch (error) {
    console.error('[Job Triage] Error saving settings:', error);
    showStatus('Failed to save settings', 'error');
  }
}

/**
 * Show status message
 */
function showStatus(message: string, type: 'success' | 'error') {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.style.display = 'block';

  // Auto-hide after 3 seconds
  setTimeout(() => {
    statusDiv.style.display = 'none';
  }, 3000);
}

// Event listeners
saveButton.addEventListener('click', saveSettings);

// Load settings on page load
loadSettings();
