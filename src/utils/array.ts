export function flatten<T>(...arrays: ReadonlyArray<T>[]): ReadonlyArray<T> {
    return Array.of<T>().concat(...arrays);
}

export function definedOf<T>(...items: (T | undefined)[]): T[] {
    return items.filter((i) => i !== undefined).map((i) => i!);
}
