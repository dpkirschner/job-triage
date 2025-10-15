/**
 * IndexedDB storage wrapper for Job Triage
 * Provides type-safe access to persistent storage
 */

import { Job, Settings, Profile, Embedding, StorageKeys } from './types';

const DB_NAME = 'JobTriageDB';
const DB_VERSION = 1;

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

      // Jobs store
      if (!db.objectStoreNames.contains(StorageKeys.JOBS)) {
        const jobStore = db.createObjectStore(StorageKeys.JOBS, { keyPath: 'id' });
        jobStore.createIndex('url', 'url', { unique: true });
        jobStore.createIndex('firstSeen', 'firstSeen', { unique: false });
        jobStore.createIndex('score', 'score', { unique: false });
      }

      // Settings store
      if (!db.objectStoreNames.contains(StorageKeys.SETTINGS)) {
        db.createObjectStore(StorageKeys.SETTINGS, { keyPath: 'id' });
      }

      // Profiles store
      if (!db.objectStoreNames.contains(StorageKeys.PROFILES)) {
        db.createObjectStore(StorageKeys.PROFILES, { keyPath: 'id' });
      }

      // Embeddings store
      if (!db.objectStoreNames.contains(StorageKeys.EMBEDDINGS)) {
        const embeddingStore = db.createObjectStore(StorageKeys.EMBEDDINGS, { keyPath: 'hash' });
        embeddingStore.createIndex('createdAt', 'createdAt', { unique: false });
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
 * Job storage operations
 */
export const JobStorage = {
  async get(id: string): Promise<Job | null> {
    return get<Job>(StorageKeys.JOBS, id);
  },

  async save(job: Job): Promise<void> {
    return put(StorageKeys.JOBS, job);
  },

  async getAll(): Promise<Job[]> {
    return getAll<Job>(StorageKeys.JOBS);
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
};
