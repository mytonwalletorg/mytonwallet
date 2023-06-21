import type { Storage } from './types';

// eslint-disable-next-line no-restricted-globals
const storage = self.chrome?.storage.local;

export default ((storage && {
  getItem: async (key) => (await storage.get(key))?.[key],
  setItem: (key, value) => storage.set({ [key]: value }),
  removeItem: storage.remove.bind(storage),
  clear: storage.clear.bind(storage),
  getAll: storage.get.bind(storage),
  setMany: storage.set.bind(storage),
  getMany: storage.get.bind(storage),
}) || {}) as Storage;
