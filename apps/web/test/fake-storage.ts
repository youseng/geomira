/** An in-memory localStorage for the autosave tests (Node has none). */
export function installStorage(): Map<string, string> {
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
  };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  return data;
}

export function removeStorage(): void {
  Reflect.deleteProperty(globalThis, 'localStorage');
}

export const SLOT = {
  current: 'geomira.autosave.current',
  previous: 'geomira.autosave.previous',
} as const;
