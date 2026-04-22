export class AsyncLazy<T> {
  private instance?: T;
  private createInstance: () => Promise<T>;
  public async get(): Promise<T> {
    if (this.instance) return this.instance as T;
    this.instance = await this.createInstance();
    return this.instance;
  }
  constructor(createInstance: () => Promise<T>) {
    this.createInstance = createInstance;
  }
}

export class Lazy<T> {
  private instance?: T;
  private createInstance: () => T;
  public get(): T {
    if (this.instance) return this.instance as T;
    this.instance = this.createInstance();
    return this.instance;
  }
  constructor(createInstance: () => T) {
    this.createInstance = createInstance;
  }
}
