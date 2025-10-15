/**
 * Content script - Injects overlay UI into career pages
 */

import { OVERLAY } from '@/shared/constants';

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
  body.style.cssText = `
    padding: 16px;
    overflow-y: auto;
    flex: 1;
  `;
  body.innerHTML = `
    <p style="margin: 0 0 12px 0; color: #666;">
      Extension initialized successfully!
    </p>
    <p style="margin: 0; font-size: 14px; color: #999;">
      Ready to scan job listings on this page.
    </p>
  `;

  overlay.appendChild(header);
  overlay.appendChild(body);

  return overlay;
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
}

// Start initialization
init();
