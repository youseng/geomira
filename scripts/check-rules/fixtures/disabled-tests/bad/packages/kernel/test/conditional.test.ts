import { describe, it } from 'vitest';
it.skipIf(true)('a', () => {});
describe.runIf(false)('b', () => {});
it.concurrent.skip('c', () => {});
