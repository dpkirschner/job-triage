/**
 * Vitest global setup file
 * Initializes fake-indexeddb and mocks Chrome extension APIs
 */

import 'fake-indexeddb/auto';
import { beforeEach, vi } from 'vitest';

/**
 * Mock Chrome extension APIs
 */
const mockChrome = {
  runtime: {
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    sendMessage: vi.fn(),
    openOptionsPage: vi.fn(),
  },
  action: {
    onClicked: {
      addListener: vi.fn(),
    },
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    },
  },
};

// @ts-expect-error - Mock global chrome API
global.chrome = mockChrome;

/**
 * Reset all mocks before each test
 */
beforeEach(() => {
  vi.clearAllMocks();
});
