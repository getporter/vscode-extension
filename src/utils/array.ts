export function flatten<T>(...arrays: ReadonlyArray<T>[]): ReadonlyArray<T> {
    return Array.of<T>().concat(...arrays);
}

export function definedOf<T>(...items: (T | undefined)[]): T[] {
    return items.filter((i) => i !== undefined).map((i) => i!);
}

declare global {
    interface Array<T> {
        filterAsync<T>(fn: (t: T) => Thenable<boolean>): Promise<T[]>;
    }
}

async function filterAsync<T>(this: T[], fn: (t: T) => Thenable<boolean>): Promise<T[]> {
    const filterablePromises = this.map((o) => ({ accept: fn(o), value: o }));
    const filterables = await Promise.all(filterablePromises);
    return filterables.filter((o) => o.accept).map((o) => o.value);
}

if (!Array.prototype.filterAsync) {
    Object.defineProperty(Array.prototype, 'filterAsync', {
        enumerable: false,
        value: filterAsync
    });
}
