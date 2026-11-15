/** A transactional adapter: the result is published only after the simulated commit. */
import { EMPTY_RECOVERY, type RecoveryState } from '@geomira/editor/persistence';
import type { RevisionStorage } from '../src/revision-storage';

export class MemoryRevisions implements RevisionStorage {
  state: RecoveryState = EMPTY_RECOVERY;
  failure: 'read' | 'put' | 'complete' | null = null;
  barrier: Promise<void> | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  read(): Promise<RecoveryState> {
    if (this.failure === 'read')
      return Promise.reject(new DOMException('blocked', 'SecurityError'));
    return Promise.resolve(structuredClone(this.state));
  }

  update(change: (state: RecoveryState) => RecoveryState): Promise<RecoveryState> {
    const operation = this.queue.then(async () => {
      await this.barrier;
      const before = await this.read();
      const next = change(before);
      if (this.failure === 'put') throw new DOMException('full', 'QuotaExceededError');
      if (this.failure === 'complete') throw new DOMException('aborted after put', 'AbortError');
      this.state = structuredClone(next);
      return next;
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }
}
