export class Dictionary<K, V> {
  private map = new Map<K, V>();

  // Set or update
  set(key: K, value: V): void {
    this.map.set(key, value);
  }

  get(key: K): V | undefined {
    return this.map.get(key);
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  // Try get: return {found, value}
  tryGet(key: K): V | undefined {
    if (this.map.has(key)) {
      return this.map.get(key);
    }
    return undefined;
  }

  // Get if exists, otherwise add with given value
  getOrAdd(key: K, value: V): V {
    if (this.map.has(key)) {
      return this.map.get(key)!;
    }
    this.map.set(key, value);
    return value;
  }

  // Add new or update existing with new value
  addOrUpdate(key: K, value: V): V {
    this.map.set(key, value);
    return value;
  }

  delete(key: K): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}
