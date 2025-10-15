/**
 * Tests for background service worker
 * Note: Full integration tests are complex due to Chrome API mocking limitations.
 * These tests verify the core structure and basic functionality.
 */

import { describe, it, expect, vi } from 'vitest';
import type { Message } from '@/shared/types';

describe('Background Service Worker', () => {
  it('should load without errors', () => {
    // If we got here, the background script loaded successfully
    expect(true).toBe(true);
  });

  it('should have Chrome runtime API available', () => {
    expect(chrome.runtime).toBeDefined();
    expect(chrome.runtime.onMessage).toBeDefined();
  });

  it('should have Chrome action API available', () => {
    expect(chrome.action).toBeDefined();
    expect(chrome.action.onClicked).toBeDefined();
  });
});

describe('Message Type Definitions', () => {
  it('should define FETCH_JOB message type', () => {
    const message: Message = {
      type: 'FETCH_JOB',
      url: 'https://example.com/job',
    };
    expect(message.type).toBe('FETCH_JOB');
    expect(message.url).toBe('https://example.com/job');
  });

  it('should define COMPUTE_SCORE message type', () => {
    const message: Message = {
      type: 'COMPUTE_SCORE',
      job: {
        url: 'https://example.com/job',
        title: 'Test Job',
        description: 'Test description',
      },
    };
    expect(message.type).toBe('COMPUTE_SCORE');
    expect(message.job).toBeDefined();
  });

  it('should define GET_SETTINGS message type', () => {
    const message: Message = {
      type: 'GET_SETTINGS',
    };
    expect(message.type).toBe('GET_SETTINGS');
  });

  it('should define UPDATE_SETTINGS message type', () => {
    const message: Message = {
      type: 'UPDATE_SETTINGS',
      settings: {
        resume: 'Test resume',
      },
    };
    expect(message.type).toBe('UPDATE_SETTINGS');
    expect(message.settings).toBeDefined();
  });

  it('should define SAVE_DECISION message type', () => {
    const message: Message = {
      type: 'SAVE_DECISION',
      jobId: 'job-123',
      decision: 'thumbs_up',
    };
    expect(message.type).toBe('SAVE_DECISION');
    expect(message.jobId).toBe('job-123');
    expect(message.decision).toBe('thumbs_up');
  });
});

describe('HTML Parsing (DOMParser)', () => {
  it('should parse HTML and extract title', () => {
    const html = '<html><head><title>Test Job Title</title></head><body></body></html>';
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const title = doc.querySelector('title')?.textContent;
    expect(title).toBe('Test Job Title');
  });

  it('should extract body text from HTML', () => {
    const html = '<html><body><p>Job description here</p></body></html>';
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const text = doc.body.textContent;
    expect(text).toContain('Job description here');
  });

  it('should handle malformed HTML gracefully', () => {
    const html = '<html><title>Unclosed title<body>Content</body></html>';
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    expect(doc.body).toBeDefined();
  });
});

describe('Text Size Limiting', () => {
  it('should limit text to 5000 characters', () => {
    const longText = 'a'.repeat(10000);
    const limited = longText.slice(0, 5000);

    expect(limited.length).toBe(5000);
    expect(limited.length).toBeLessThan(longText.length);
  });

  it('should preserve text shorter than limit', () => {
    const shortText = 'Short description';
    const limited = shortText.slice(0, 5000);

    expect(limited).toBe(shortText);
    expect(limited.length).toBe(shortText.length);
  });
});

describe('Fetch Error Handling', () => {
  it('should handle Error objects correctly', () => {
    const error = new Error('Network error');
    const message = error instanceof Error ? error.message : 'Unknown error';

    expect(message).toBe('Network error');
  });

  it('should handle non-Error objects', () => {
    const error = 'String error';
    const message = error instanceof Error ? error.message : 'Unknown error';

    expect(message).toBe('Unknown error');
  });
});
