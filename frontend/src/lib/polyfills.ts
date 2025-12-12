// Polyfills for server-side rendering
// Prevents errors when Web3 libraries try to access browser APIs during SSR

if (typeof window === 'undefined') {
  // Mock indexedDB for SSR with full API
  const mockIDBRequest = {
    onsuccess: null,
    onerror: null,
    result: null,
    error: null,
    readyState: 'done',
  };

  global.indexedDB = {
    open: () => mockIDBRequest,
    deleteDatabase: () => mockIDBRequest,
    databases: async () => [],
    cmp: () => 0,
  } as any;

  // Mock localStorage for SSR
  if (!global.localStorage) {
    global.localStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    } as Storage;
  }

  // Mock sessionStorage for SSR
  if (!global.sessionStorage) {
    global.sessionStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    } as Storage;
  }
}

export {};
