// 在 Node 里运行 store 前的最小浏览器环境桩；必须最先被导入。
const storage = new Map<string, string>();
const g = globalThis as Record<string, unknown>;
g.localStorage = {
  getItem: (key: string) => (storage.has(key) ? storage.get(key)! : null),
  setItem: (key: string, value: string) => storage.set(key, String(value)),
  removeItem: (key: string) => storage.delete(key)
};
g.window = globalThis;
