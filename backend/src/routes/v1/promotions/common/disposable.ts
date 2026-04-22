export interface IDisposable {
  dispose(): void | Promise<void>;
}

export async function Using<T extends IDisposable, R>(
  disposable: T,
  func: (disposable: T) => Promise<R>
): Promise<R> {
  try {
    return await func(disposable);
  } finally {
    await disposable.dispose();
  }
}
