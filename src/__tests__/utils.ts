/**
 * Test utility functions
 */

/**
 * Wait for IndexedDB operations to complete
 */
export async function waitForDB(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Clear all IndexedDB databases (cleanup between tests)
 */
export async function clearAllDatabases(): Promise<void> {
  const dbs = await indexedDB.databases();
  await Promise.all(
    dbs.map((db) => {
      if (db.name) {
        return new Promise<void>((resolve, reject) => {
          const request = indexedDB.deleteDatabase(db.name!);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }
    })
  );
}

/**
 * Wait for a condition to be true (useful for async operations)
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 1000
): Promise<void> {
  const start = Date.now();
  while (!(await condition())) {
    if (Date.now() - start > timeout) {
      throw new Error('waitFor timeout exceeded');
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
