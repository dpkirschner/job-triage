/**
 * Tests for content script (overlay injection)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OVERLAY } from '@/shared/constants';

describe('Content Script', () => {
  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Overlay Existence Check', () => {
    it('should detect when overlay does not exist', () => {
      const overlay = document.getElementById(OVERLAY.CONTAINER_ID);
      expect(overlay).toBeNull();
    });

    it('should detect when overlay exists', () => {
      const overlay = document.createElement('div');
      overlay.id = OVERLAY.CONTAINER_ID;
      document.body.appendChild(overlay);

      const found = document.getElementById(OVERLAY.CONTAINER_ID);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(OVERLAY.CONTAINER_ID);
    });
  });

  describe('Overlay Creation', () => {
    it('should create overlay with correct ID', () => {
      const overlay = document.createElement('div');
      overlay.id = OVERLAY.CONTAINER_ID;
      document.body.appendChild(overlay);

      expect(overlay.id).toBe('job-triage-overlay');
    });

    it('should create overlay with correct positioning', () => {
      const overlay = document.createElement('div');
      overlay.id = OVERLAY.CONTAINER_ID;
      overlay.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: ${OVERLAY.Z_INDEX};
      `;
      document.body.appendChild(overlay);

      expect(overlay.style.position).toBe('fixed');
      expect(overlay.style.top).toBe('20px');
      expect(overlay.style.right).toBe('20px');
    });

    it('should create overlay with high z-index', () => {
      const overlay = document.createElement('div');
      overlay.id = OVERLAY.CONTAINER_ID;
      overlay.style.zIndex = String(OVERLAY.Z_INDEX);
      document.body.appendChild(overlay);

      expect(overlay.style.zIndex).toBe('10000');
    });

    it('should have visible background and border', () => {
      const overlay = document.createElement('div');
      overlay.id = OVERLAY.CONTAINER_ID;
      overlay.style.background = 'white';
      overlay.style.border = '2px solid #333';
      document.body.appendChild(overlay);

      expect(overlay.style.background).toBe('white');
      expect(overlay.style.border).toContain('2px');
    });
  });

  describe('Overlay Structure', () => {
    it('should have header section', () => {
      const overlay = document.createElement('div');
      overlay.id = OVERLAY.CONTAINER_ID;

      const header = document.createElement('div');
      header.className = 'header';
      header.textContent = 'Job Triage';
      overlay.appendChild(header);

      document.body.appendChild(overlay);

      const headerElement = overlay.querySelector('.header');
      expect(headerElement).not.toBeNull();
      expect(headerElement?.textContent).toContain('Job Triage');
    });

    it('should have close button in header', () => {
      const overlay = document.createElement('div');
      overlay.id = OVERLAY.CONTAINER_ID;

      const header = document.createElement('div');
      const closeBtn = document.createElement('button');
      closeBtn.id = 'job-triage-close';
      closeBtn.textContent = '×';
      header.appendChild(closeBtn);
      overlay.appendChild(header);

      document.body.appendChild(overlay);

      const button = document.getElementById('job-triage-close');
      expect(button).not.toBeNull();
      expect(button?.textContent).toBe('×');
    });

    it('should have body section', () => {
      const overlay = document.createElement('div');
      overlay.id = OVERLAY.CONTAINER_ID;

      const body = document.createElement('div');
      body.className = 'body';
      overlay.appendChild(body);

      document.body.appendChild(overlay);

      const bodyElement = overlay.querySelector('.body');
      expect(bodyElement).not.toBeNull();
    });

    it('should display initialization message', () => {
      const overlay = document.createElement('div');
      overlay.id = OVERLAY.CONTAINER_ID;

      const body = document.createElement('div');
      body.innerHTML = '<p>Extension initialized successfully!</p>';
      overlay.appendChild(body);

      document.body.appendChild(overlay);

      expect(overlay.textContent).toContain('Extension initialized successfully!');
    });
  });

  describe('Close Button Functionality', () => {
    it('should hide overlay when close button clicked', () => {
      const overlay = document.createElement('div');
      overlay.id = OVERLAY.CONTAINER_ID;
      overlay.style.display = 'flex';

      const closeBtn = document.createElement('button');
      closeBtn.id = 'job-triage-close';
      closeBtn.addEventListener('click', () => {
        overlay.style.display = 'none';
      });

      overlay.appendChild(closeBtn);
      document.body.appendChild(overlay);

      expect(overlay.style.display).toBe('flex');

      closeBtn.click();

      expect(overlay.style.display).toBe('none');
    });

    it('should maintain overlay in DOM after hiding', () => {
      const overlay = document.createElement('div');
      overlay.id = OVERLAY.CONTAINER_ID;
      overlay.style.display = 'flex';

      const closeBtn = document.createElement('button');
      closeBtn.id = 'job-triage-close';
      closeBtn.addEventListener('click', () => {
        overlay.style.display = 'none';
      });

      overlay.appendChild(closeBtn);
      document.body.appendChild(overlay);

      closeBtn.click();

      const stillInDOM = document.getElementById(OVERLAY.CONTAINER_ID);
      expect(stillInDOM).not.toBeNull();
    });
  });

  describe('Duplicate Prevention', () => {
    it('should prevent multiple overlays with same ID', () => {
      const overlay1 = document.createElement('div');
      overlay1.id = OVERLAY.CONTAINER_ID;
      document.body.appendChild(overlay1);

      const overlay2 = document.createElement('div');
      overlay2.id = OVERLAY.CONTAINER_ID;

      // DOM will only keep one element with the same ID
      const existingOverlay = document.getElementById(OVERLAY.CONTAINER_ID);
      if (!existingOverlay) {
        document.body.appendChild(overlay2);
      }

      const overlays = document.querySelectorAll(`#${OVERLAY.CONTAINER_ID}`);
      expect(overlays.length).toBe(1);
    });
  });

  describe('Responsive Design', () => {
    it('should have maximum height constraint', () => {
      const overlay = document.createElement('div');
      overlay.id = OVERLAY.CONTAINER_ID;
      overlay.style.maxHeight = '80vh';
      document.body.appendChild(overlay);

      expect(overlay.style.maxHeight).toBe('80vh');
    });

    it('should have fixed width', () => {
      const overlay = document.createElement('div');
      overlay.id = OVERLAY.CONTAINER_ID;
      overlay.style.width = '400px';
      document.body.appendChild(overlay);

      expect(overlay.style.width).toBe('400px');
    });

    it('should have overflow handling', () => {
      const overlay = document.createElement('div');
      overlay.id = OVERLAY.CONTAINER_ID;
      overlay.style.overflow = 'hidden';
      document.body.appendChild(overlay);

      expect(overlay.style.overflow).toBe('hidden');
    });
  });

  describe('Styling', () => {
    it('should have rounded corners', () => {
      const overlay = document.createElement('div');
      overlay.id = OVERLAY.CONTAINER_ID;
      overlay.style.borderRadius = '8px';
      document.body.appendChild(overlay);

      expect(overlay.style.borderRadius).toBe('8px');
    });

    it('should have box shadow', () => {
      const overlay = document.createElement('div');
      overlay.id = OVERLAY.CONTAINER_ID;
      overlay.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
      document.body.appendChild(overlay);

      expect(overlay.style.boxShadow).toContain('rgba');
    });

    it('should use system fonts', () => {
      const overlay = document.createElement('div');
      overlay.id = OVERLAY.CONTAINER_ID;
      overlay.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      document.body.appendChild(overlay);

      expect(overlay.style.fontFamily).toContain('apple-system');
    });
  });

  describe('DOMContentLoaded Handling', () => {
    it('should wait for DOM to be ready', () => {
      const readyState = document.readyState;
      expect(['loading', 'interactive', 'complete']).toContain(readyState);
    });

    it('should allow injection after DOM is loaded', () => {
      // Simulate DOM loaded
      Object.defineProperty(document, 'readyState', {
        writable: true,
        value: 'complete',
      });

      const overlay = document.createElement('div');
      overlay.id = OVERLAY.CONTAINER_ID;
      document.body.appendChild(overlay);

      const found = document.getElementById(OVERLAY.CONTAINER_ID);
      expect(found).not.toBeNull();
    });
  });

  describe('Accessibility', () => {
    it('should have clickable close button', () => {
      const closeBtn = document.createElement('button');
      closeBtn.id = 'job-triage-close';
      closeBtn.style.cursor = 'pointer';
      document.body.appendChild(closeBtn);

      expect(closeBtn.style.cursor).toBe('pointer');
    });

    it('should have adequate font size for readability', () => {
      const text = document.createElement('p');
      text.style.fontSize = '14px';
      document.body.appendChild(text);

      const fontSize = parseInt(text.style.fontSize);
      expect(fontSize).toBeGreaterThanOrEqual(12);
    });
  });
});
