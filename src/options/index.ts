/**
 * Options page - Settings UI logic
 */

import { SettingsStorage } from '@/shared/storage';
import { DEFAULT_SETTINGS } from '@/shared/constants';
import type { Settings } from '@/shared/types';

console.log('[Job Triage] Options page loaded');

// Get DOM elements
const resumeTextarea = document.getElementById('resume') as HTMLTextAreaElement;
const resumeCounter = document.getElementById('resume-counter') as HTMLDivElement;
const resumeError = document.getElementById('resume-error') as HTMLDivElement;

const stacksInput = document.getElementById('stacks') as HTMLInputElement;
const rolesInput = document.getElementById('roles') as HTMLInputElement;

const remoteCheckbox = document.getElementById('remote') as HTMLInputElement;
const hybridCheckbox = document.getElementById('hybrid') as HTMLInputElement;
const onsiteCheckbox = document.getElementById('onsite') as HTMLInputElement;
const citiesInput = document.getElementById('cities') as HTMLInputElement;

const thresholdInput = document.getElementById('threshold') as HTMLInputElement;
const thresholdError = document.getElementById('threshold-error') as HTMLDivElement;

const saveButton = document.getElementById('save') as HTMLButtonElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;

/**
 * Load settings from storage and populate form
 */
async function loadSettings() {
  try {
    const settings = await SettingsStorage.get();
    const effectiveSettings = settings || DEFAULT_SETTINGS;

    // Resume
    resumeTextarea.value = effectiveSettings.resume;
    updateCharCounter();

    // Preferences
    stacksInput.value = effectiveSettings.preferredStacks.join(', ');
    rolesInput.value = effectiveSettings.preferredRoles.join(', ');

    // Location preferences
    remoteCheckbox.checked = effectiveSettings.locationPreferences.remote;
    hybridCheckbox.checked = effectiveSettings.locationPreferences.hybrid;
    onsiteCheckbox.checked = effectiveSettings.locationPreferences.onsite;
    citiesInput.value = (effectiveSettings.locationPreferences.cities || []).join(', ');

    // Threshold
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
  // Validate before saving
  if (!validateSettings()) {
    showStatus('Please fix validation errors before saving', 'error');
    return;
  }

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
      locationPreferences: {
        remote: remoteCheckbox.checked,
        hybrid: hybridCheckbox.checked,
        onsite: onsiteCheckbox.checked,
        cities: citiesInput.value
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean),
      },
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
 * Validate settings form
 */
function validateSettings(): boolean {
  let isValid = true;

  // Validate resume (optional but recommended)
  const resumeValue = resumeTextarea.value.trim();
  if (resumeValue.length === 0) {
    resumeError.classList.add('show');
    resumeTextarea.classList.add('error');
    // Don't block saving, just warn
  } else {
    resumeError.classList.remove('show');
    resumeTextarea.classList.remove('error');
  }

  // Validate threshold (required, 0-10)
  const threshold = parseFloat(thresholdInput.value);
  if (isNaN(threshold) || threshold < 0 || threshold > 10) {
    thresholdError.classList.add('show');
    thresholdInput.classList.add('error');
    isValid = false;
  } else {
    thresholdError.classList.remove('show');
    thresholdInput.classList.remove('error');
  }

  return isValid;
}

/**
 * Update character counter for resume
 */
function updateCharCounter() {
  const length = resumeTextarea.value.length;
  resumeCounter.textContent = `${length} character${length !== 1 ? 's' : ''}`;
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

// Real-time character counter
resumeTextarea.addEventListener('input', updateCharCounter);

// Real-time validation
thresholdInput.addEventListener('input', () => {
  const threshold = parseFloat(thresholdInput.value);
  if (!isNaN(threshold) && threshold >= 0 && threshold <= 10) {
    thresholdError.classList.remove('show');
    thresholdInput.classList.remove('error');
  }
});

// Keyboard shortcut: Cmd/Ctrl + S to save
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault();
    saveSettings();
  }
});

// Load settings on page load
loadSettings();
