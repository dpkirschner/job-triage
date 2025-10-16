/**
 * IndexedDB storage wrapper for Job Triage
 * Provides type-safe access to persistent storage
 */

import { Job, Settings, Profile, Embedding, StorageKeys } from './types';

const DB_NAME = 'JobTriageDB';
const DB_VERSION = 2;

/**
 * Initialize IndexedDB database
 */
export async function initDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const oldVersion = event.oldVersion;
      const transaction = (event.target as IDBOpenDBRequest).transaction!;

      // Migration v0 → v1: Initial schema
      if (oldVersion < 1) {
        // Jobs store
        const jobStore = db.createObjectStore(StorageKeys.JOBS, { keyPath: 'id' });
        jobStore.createIndex('url', 'url', { unique: true });
        jobStore.createIndex('firstSeen', 'firstSeen', { unique: false });
        jobStore.createIndex('score', 'score', { unique: false });

        // Settings store
        db.createObjectStore(StorageKeys.SETTINGS, { keyPath: 'id' });

        // Profiles store
        db.createObjectStore(StorageKeys.PROFILES, { keyPath: 'id' });

        // Embeddings store
        const embeddingStore = db.createObjectStore(StorageKeys.EMBEDDINGS, { keyPath: 'hash' });
        embeddingStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // Migration v1 → v2: Add decision, tags, lastUpdated indexes
      if (oldVersion < 2) {
        const jobStore = transaction.objectStore(StorageKeys.JOBS);

        // Add decision index for filtering thumbs up/down
        if (!jobStore.indexNames.contains('decision')) {
          jobStore.createIndex('decision', 'decision', { unique: false });
        }

        // Add tags index (multi-entry) for user tagging
        if (!jobStore.indexNames.contains('tags')) {
          jobStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });
        }

        // Add lastUpdated index for cache cleanup
        if (!jobStore.indexNames.contains('lastUpdated')) {
          jobStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
        }
      }
    };
  });
}

/**
 * Generic IndexedDB get operation
 */
async function get<T>(storeName: string, key: string): Promise<T | null> {
  const db = await initDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generic IndexedDB put operation
 */
async function put<T>(storeName: string, value: T): Promise<void> {
  const db = await initDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(value);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generic IndexedDB getAll operation
 */
async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await initDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generic IndexedDB delete operation
 */
async function deleteItem(storeName: string, key: string): Promise<void> {
  const db = await initDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generic IndexedDB deleteMany operation
 */
async function deleteMany(storeName: string, keys: string[]): Promise<void> {
  const db = await initDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);

    let completed = 0;
    let hasError = false;

    for (const key of keys) {
      const request = store.delete(key);
      request.onsuccess = () => {
        completed++;
        if (completed === keys.length && !hasError) {
          resolve();
        }
      };
      request.onerror = () => {
        if (!hasError) {
          hasError = true;
          reject(request.error);
        }
      };
    }

    // Handle empty array
    if (keys.length === 0) {
      resolve();
    }
  });
}

/**
 * Generic IndexedDB clear operation
 */
async function clear(storeName: string): Promise<void> {
  const db = await initDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generic IndexedDB count operation
 */
async function count(storeName: string, query?: IDBValidKey | IDBKeyRange): Promise<number> {
  const db = await initDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = query ? store.count(query) : store.count();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generic IndexedDB query by index
 */
async function queryByIndex<T>(
  storeName: string,
  indexName: string,
  query: IDBValidKey | IDBKeyRange
): Promise<T[]> {
  const db = await initDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(query);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generic IndexedDB cursor operation for complex queries
 */
async function queryCursor<T>(
  storeName: string,
  filter: (item: T) => boolean,
  options?: { limit?: number; indexName?: string; direction?: IDBCursorDirection }
): Promise<T[]> {
  const db = await initDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const source = options?.indexName ? store.index(options.indexName) : store;
    const request = source.openCursor(null, options?.direction);

    const results: T[] = [];

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

      if (!cursor || (options?.limit && results.length >= options.limit)) {
        resolve(results);
        return;
      }

      const item = cursor.value as T;
      if (filter(item)) {
        results.push(item);
      }

      cursor.continue();
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Job storage operations
 */
export const JobStorage = {
  // Basic CRUD
  async get(id: string): Promise<Job | null> {
    return get<Job>(StorageKeys.JOBS, id);
  },

  async save(job: Job): Promise<void> {
    return put(StorageKeys.JOBS, job);
  },

  async getAll(): Promise<Job[]> {
    return getAll<Job>(StorageKeys.JOBS);
  },

  // Bulk operations
  async saveMany(jobs: Job[]): Promise<void> {
    const db = await initDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(StorageKeys.JOBS, 'readwrite');
      const store = transaction.objectStore(StorageKeys.JOBS);

      let completed = 0;
      let hasError = false;

      for (const job of jobs) {
        const request = store.put(job);
        request.onsuccess = () => {
          completed++;
          if (completed === jobs.length && !hasError) {
            resolve();
          }
        };
        request.onerror = () => {
          if (!hasError) {
            hasError = true;
            reject(request.error);
          }
        };
      }

      if (jobs.length === 0) {
        resolve();
      }
    });
  },

  // Delete operations
  async delete(id: string): Promise<void> {
    return deleteItem(StorageKeys.JOBS, id);
  },

  async deleteMany(ids: string[]): Promise<void> {
    return deleteMany(StorageKeys.JOBS, ids);
  },

  async clear(): Promise<void> {
    return clear(StorageKeys.JOBS);
  },

  // Query operations
  async getByDecision(decision: 'thumbs_up' | 'thumbs_down'): Promise<Job[]> {
    return queryByIndex<Job>(StorageKeys.JOBS, 'decision', decision);
  },

  async getByScoreRange(min: number, max: number): Promise<Job[]> {
    const range = IDBKeyRange.bound(min, max);
    return queryByIndex<Job>(StorageKeys.JOBS, 'score', range);
  },

  async getByTag(tag: string): Promise<Job[]> {
    return queryByIndex<Job>(StorageKeys.JOBS, 'tags', tag);
  },

  async getRecent(limit: number, offset: number = 0): Promise<Job[]> {
    const all = await queryByIndex<Job>(
      StorageKeys.JOBS,
      'firstSeen',
      IDBKeyRange.lowerBound(0)
    );
    // Sort by firstSeen descending and apply limit/offset
    return all
      .sort((a, b) => b.firstSeen - a.firstSeen)
      .slice(offset, offset + limit);
  },

  async getByDateRange(start: number, end: number): Promise<Job[]> {
    const range = IDBKeyRange.bound(start, end);
    return queryByIndex<Job>(StorageKeys.JOBS, 'firstSeen', range);
  },

  async exists(url: string): Promise<boolean> {
    const db = await initDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(StorageKeys.JOBS, 'readonly');
      const store = transaction.objectStore(StorageKeys.JOBS);
      const index = store.index('url');
      const request = index.getKey(url);

      request.onsuccess = () => resolve(request.result !== undefined);
      request.onerror = () => reject(request.error);
    });
  },

  async getByUrls(urls: string[]): Promise<Job[]> {
    const db = await initDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(StorageKeys.JOBS, 'readonly');
      const store = transaction.objectStore(StorageKeys.JOBS);
      const index = store.index('url');
      const results: Job[] = [];
      let completed = 0;

      for (const url of urls) {
        const request = index.get(url);
        request.onsuccess = () => {
          if (request.result) {
            results.push(request.result);
          }
          completed++;
          if (completed === urls.length) {
            resolve(results);
          }
        };
        request.onerror = () => {
          completed++;
          if (completed === urls.length) {
            resolve(results);
          }
        };
      }

      // Handle empty array
      if (urls.length === 0) {
        resolve([]);
      }
    });
  },

  // Count operations
  async count(): Promise<number> {
    return count(StorageKeys.JOBS);
  },

  async countByDecision(decision: 'thumbs_up' | 'thumbs_down'): Promise<number> {
    const jobs = await queryByIndex<Job>(StorageKeys.JOBS, 'decision', decision);
    return jobs.length;
  },

  async countByScoreRange(min: number, max: number): Promise<number> {
    const range = IDBKeyRange.bound(min, max);
    const jobs = await queryByIndex<Job>(StorageKeys.JOBS, 'score', range);
    return jobs.length;
  },

  // Cache cleanup operations
  async deleteOlderThan(days: number): Promise<void> {
    const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
    const jobs = await getAll<Job>(StorageKeys.JOBS);
    const toDelete = jobs.filter((job) => job.lastUpdated < cutoffTime).map((job) => job.id);
    return deleteMany(StorageKeys.JOBS, toDelete);
  },

  async pruneByScore(keepTopN: number): Promise<void> {
    const jobs = await getAll<Job>(StorageKeys.JOBS);
    // Sort by score descending, keep top N, delete rest
    const sorted = jobs.filter((j) => j.score !== undefined).sort((a, b) => (b.score || 0) - (a.score || 0));

    if (sorted.length <= keepTopN) {
      return; // Nothing to prune
    }

    const toDelete = sorted.slice(keepTopN).map((job) => job.id);
    return deleteMany(StorageKeys.JOBS, toDelete);
  },

  async deleteDecided(olderThanDays: number): Promise<void> {
    const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    const jobs = await getAll<Job>(StorageKeys.JOBS);
    const toDelete = jobs
      .filter((job) => job.decision && job.lastUpdated < cutoffTime)
      .map((job) => job.id);
    return deleteMany(StorageKeys.JOBS, toDelete);
  },
};

/**
 * Settings storage operations
 */
export const SettingsStorage = {
  async get(): Promise<Settings | null> {
    return get<Settings>(StorageKeys.SETTINGS, 'default');
  },

  async save(settings: Settings): Promise<void> {
    return put(StorageKeys.SETTINGS, { id: 'default', ...settings });
  },
};

/**
 * Profile storage operations
 */
export const ProfileStorage = {
  async get(id: string): Promise<Profile | null> {
    return get<Profile>(StorageKeys.PROFILES, id);
  },

  async save(profile: Profile): Promise<void> {
    return put(StorageKeys.PROFILES, profile);
  },

  async getAll(): Promise<Profile[]> {
    return getAll<Profile>(StorageKeys.PROFILES);
  },

  async delete(id: string): Promise<void> {
    return deleteItem(StorageKeys.PROFILES, id);
  },

  async count(): Promise<number> {
    return count(StorageKeys.PROFILES);
  },
};

/**
 * Embedding storage operations
 */
export const EmbeddingStorage = {
  async get(hash: string): Promise<Embedding | null> {
    return get<Embedding>(StorageKeys.EMBEDDINGS, hash);
  },

  async save(embedding: Embedding): Promise<void> {
    return put(StorageKeys.EMBEDDINGS, embedding);
  },

  async delete(hash: string): Promise<void> {
    return deleteItem(StorageKeys.EMBEDDINGS, hash);
  },

  async deleteOlderThan(timestamp: number): Promise<void> {
    const embeddings = await getAll<Embedding>(StorageKeys.EMBEDDINGS);
    const toDelete = embeddings.filter((emb) => emb.createdAt < timestamp).map((emb) => emb.hash);
    return deleteMany(StorageKeys.EMBEDDINGS, toDelete);
  },

  async count(): Promise<number> {
    return count(StorageKeys.EMBEDDINGS);
  },
};
