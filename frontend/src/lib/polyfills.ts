// Polyfills for server-side rendering
// Prevents errors when Web3 libraries try to access browser APIs during SSR

if (typeof window === 'undefined') {
  // Create a more complete mock of IDBRequest
  class MockIDBRequest {
    onsuccess = null;
    onerror = null;
    result = null;
    error = null;
    readyState = 'done';
    source = null;
    transaction = null;

    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() { return true; }
  }

  // Create mock IDBObjectStore
  class MockIDBObjectStore {
    name = '';
    keyPath = null;
    indexNames = [];
    autoIncrement = false;

    add() { return new MockIDBRequest(); }
    clear() { return new MockIDBRequest(); }
    delete() { return new MockIDBRequest(); }
    get() { return new MockIDBRequest(); }
    getAll() { return new MockIDBRequest(); }
    getAllKeys() { return new MockIDBRequest(); }
    getKey() { return new MockIDBRequest(); }
    put() { return new MockIDBRequest(); }
    openCursor() { return new MockIDBRequest(); }
    createIndex() { return {}; }
    deleteIndex() {}
    index() { return {}; }
  }

  // Create mock IDBTransaction
  class MockIDBTransaction {
    db = null;
    mode = 'readonly';
    objectStoreNames = [];
    error = null;

    abort() {}
    objectStore() { return new MockIDBObjectStore(); }
    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() { return true; }
  }

  // Create mock IDBDatabase
  class MockIDBDatabase {
    name = '';
    version = 1;
    objectStoreNames = [];

    close() {}
    createObjectStore() { return new MockIDBObjectStore(); }
    deleteObjectStore() {}
    transaction() { return new MockIDBTransaction(); }
    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() { return true; }
  }

  // Mock IndexedDB
  const mockIndexedDB = {
    open: (_name?: string, _version?: number) => {
      const request = new MockIDBRequest();
      // Simulate async success
      setTimeout(() => {
        if (request.onsuccess && typeof request.onsuccess === 'function') {
          (request as any).result = new MockIDBDatabase();
          (request.onsuccess as any)({ target: request });
        }
      }, 0);
      return request;
    },
    deleteDatabase: () => new MockIDBRequest(),
    databases: async () => [],
    cmp: () => 0,
  };

  // Apply polyfills
  (global as any).indexedDB = mockIndexedDB;
  (global as any).IDBDatabase = MockIDBDatabase;
  (global as any).IDBRequest = MockIDBRequest;

  // Mock localStorage
  if (!(global as any).localStorage) {
    (global as any).localStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    };
  }

  // Mock sessionStorage
  if (!(global as any).sessionStorage) {
    (global as any).sessionStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    };
  }

  // Mock location for SSR
  if (!(global as any).location) {
    (global as any).location = {
      href: 'http://localhost:3000',
      origin: 'http://localhost:3000',
      protocol: 'http:',
      host: 'localhost:3000',
      hostname: 'localhost',
      port: '3000',
      pathname: '/',
      search: '',
      hash: '',
      assign: () => {},
      reload: () => {},
      replace: () => {},
    };
  }

  // Mock document for SSR
  if (!(global as any).document) {
    (global as any).document = {
      createElement: () => ({}),
      createElementNS: () => ({}),
      querySelector: () => null,
      querySelectorAll: () => [],
      getElementById: () => null,
      addEventListener: () => {},
      removeEventListener: () => {},
      head: { appendChild: () => {} },
      body: { appendChild: () => {} },
      readyState: 'loading',
      cookie: '',
    };
  }

  // Mock window object for SSR
  if (!(global as any).window) {
    (global as any).window = {
      ...(global as any),
      location: (global as any).location,
      document: (global as any).document,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
      navigator: {
        userAgent: 'Node.js',
        language: 'en-US',
      },
      getComputedStyle: () => ({
        getPropertyValue: () => '',
        getPropertyPriority: () => '',
        item: () => '',
        length: 0,
      }),
      matchMedia: () => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      }),
    };
  }

  // Mock getComputedStyle globally
  if (!(global as any).getComputedStyle) {
    (global as any).getComputedStyle = (global as any).window?.getComputedStyle;
  }

  // Mock matchMedia globally
  if (!(global as any).matchMedia) {
    (global as any).matchMedia = (global as any).window?.matchMedia;
  }

  console.log('[Polyfills] Server-side polyfills loaded');
}

export {};
