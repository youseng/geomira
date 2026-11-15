import type { Page } from '@playwright/test';
import type { RecoveryState } from '@geomira/editor/persistence';

export function readRecovery(page: Page): Promise<RecoveryState> {
  return page.evaluate(
    () =>
      new Promise<RecoveryState>((resolve, reject) => {
        const request = indexedDB.open('geomira.recovery.v2', 1);
        request.onerror = () => {
          reject(request.error ?? new Error('open failed'));
        };
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('recovery', 'readonly');
          const get = tx.objectStore('recovery').get('state');
          let result: RecoveryState;
          get.onsuccess = () => {
            result = get.result as RecoveryState;
          };
          tx.oncomplete = () => {
            db.close();
            resolve(result);
          };
          tx.onabort = () => {
            db.close();
            reject(tx.error ?? new Error('read failed'));
          };
        };
      }),
  );
}
export async function currentText(page: Page): Promise<string | null> {
  const state = await readRecovery(page);
  return state.revisions.find((r) => r.id === state.currentId)?.text ?? null;
}

/** Hold every native connection's success callback until the test releases both writers. */
export async function holdConnections(page: Page, startup = false): Promise<void> {
  const install = () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    window.addEventListener('release-storage', release, { once: true });
    const open = Object.getOwnPropertyDescriptor(IDBFactory.prototype, 'open')
      ?.value as IDBFactory['open'];
    IDBFactory.prototype.open = function (...args) {
      const request = open.apply(this, args);
      Object.defineProperty(request, 'onsuccess', {
        set(listener: (event: Event) => void) {
          request.addEventListener('success', (event) => {
            document.documentElement.dataset['heldStorage'] = 'yes';
            void gate.then(() => {
              listener.call(request, event);
            });
          });
        },
      });
      return request;
    };
  };
  if (startup) await page.addInitScript(install);
  else await page.evaluate(install);
}

export async function failWrites(page: Page, stage: 'put' | 'complete'): Promise<void> {
  await page.evaluate((failure) => {
    let blocked = true;
    window.addEventListener('allow-storage', () => {
      blocked = false;
    });
    const put = Object.getOwnPropertyDescriptor(IDBObjectStore.prototype, 'put')
      ?.value as IDBObjectStore['put'];
    IDBObjectStore.prototype.put = function (...args) {
      if (blocked && failure === 'put')
        throw new DOMException('test quota full', 'QuotaExceededError');
      const result = put.apply(this, args);
      if (blocked)
        result.addEventListener('success', () => {
          this.transaction.abort();
        });
      return result;
    };
  }, stage);
}
