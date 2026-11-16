/** The only durable boundary: read/compare/put in one IndexedDB readwrite transaction. */
import { EMPTY_RECOVERY, type RecoveryState } from '@geomira/editor/persistence';
import { isRecoveryState } from './recovery-format';

export interface RevisionStorage {
  read(): Promise<RecoveryState>;
  update(change: (state: RecoveryState) => RecoveryState): Promise<RecoveryState>;
}

export const RECOVERY_DB = 'geomira.recovery.v2';
const STORE = 'recovery';
const KEY = 'state';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(RECOVERY_DB, 1);
    let blocked = false;
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE);
    };
    request.onerror = () => {
      reject(request.error ?? new Error('Storage could not open.'));
    };
    request.onblocked = () => {
      blocked = true;
      reject(new Error('Storage upgrade is blocked. Close older Geomira tabs and retry.'));
    };
    request.onsuccess = () => {
      const db = request.result;
      if (blocked) {
        db.close();
        return;
      }
      db.onversionchange = () => {
        db.close();
      };
      resolve(db);
    };
  });
}

/** Resolve only on transaction completion. A successful put can still be rolled back. */
async function transaction(
  change?: (state: RecoveryState) => RecoveryState,
): Promise<RecoveryState> {
  const db = await openDatabase();
  try {
    return await new Promise<RecoveryState>((resolve, reject) => {
      const tx = db.transaction(STORE, change === undefined ? 'readonly' : 'readwrite');
      let next: RecoveryState = EMPTY_RECOVERY;
      let failure: Error | undefined;
      tx.oncomplete = () => {
        resolve(next);
      };
      tx.onabort = () => {
        reject(failure ?? tx.error ?? new Error('Storage transaction aborted.'));
      };
      tx.onerror = () => {
        /* The abort handler owns failure reporting. */
      };
      const store = tx.objectStore(STORE);
      const get = store.get(KEY);
      get.onsuccess = () => {
        try {
          const value: unknown = get.result;
          if (value !== undefined && !isRecoveryState(value))
            throw new Error(
              'Recovery storage is damaged. Export your current figure before retrying.',
            );
          const state = value ?? EMPTY_RECOVERY;
          next = change === undefined ? state : change(state);
          if (change !== undefined) store.put(next, KEY);
        } catch (e) {
          failure = e instanceof Error ? e : new Error(String(e));
          tx.abort();
        }
      };
    });
  } finally {
    db.close();
  }
}

export class BrowserRevisions implements RevisionStorage {
  read(): Promise<RecoveryState> {
    return transaction();
  }
  update(change: (state: RecoveryState) => RecoveryState): Promise<RecoveryState> {
    return transaction(change);
  }
}
