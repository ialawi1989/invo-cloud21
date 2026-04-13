export function isPlainObject(value: any): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

export function isObject(value: any): boolean {
  return value && typeof value === 'object' && !Array.isArray(value);
}

export function deepEquals(a: any, b: any): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => deepEquals(v, b[i]));
  }
  if (isObject(a) && isObject(b)) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    return (
      aKeys.length === bKeys.length &&
      aKeys.every((k) => deepEquals(a[k], b[k]))
    );
  }
  return false;
}

export function cleanForDb<T>(input: T, defaults: T): Partial<T> {
  const result: any = {};

  for (const key in input) {
    const value = input[key];
    const defaultValue : any = defaults?.[key];

    if (Array.isArray(value)) {
      const cleanedArray = value
        .map(v => (isObject(v) ? cleanForDb(v, {}) : v))
        .filter(v => v !== undefined && v !== null && v !== false && v !== '' && v !== 0 && !(isObject(v) && Object.keys(v).length === 0));

      if (cleanedArray.length > 0 && !deepEquals(cleanedArray, defaultValue)) {
        result[key] = cleanedArray;
      }
    } else if (isObject(value)) {
      const cleanedObj = cleanForDb(value, defaultValue ?? {});
      if (Object.keys(cleanedObj).length > 0 && !deepEquals(cleanedObj, defaultValue)) {
        result[key] = cleanedObj;
      }
    } else {
      const shouldSkip =
        value === null ||
        value === undefined ||
        value === '' ||
        value === false ||
        value === 0 ||
        deepEquals(value, defaultValue);

      if (!shouldSkip) {
        result[key] = value;
      }
    }
  }

  return result;
}
