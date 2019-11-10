export function flatten<T>(...arrays: ReadonlyArray<T>[]): T[] {
    return Array.of<T>().concat(...arrays);
}

export function definedOf<T>(...items: (T | undefined)[]): T[] {
    return items.filter((i) => i !== undefined).map((i) => i!);
}

declare global {
    interface Array<T> {
        choose<U>(fn: (t: T) => U | undefined): U[];
        filterAsync(fn: (t: T) => Thenable<boolean>): Promise<T[]>;
    }
}
function choose<T, U>(this: T[], fn: (t: T) => U | undefined): U[] {
    return this.map(fn).filter((u) => u !== undefined).map((u) => u!);
}

async function filterAsync<T>(this: T[], fn: (t: T) => Thenable<boolean>): Promise<T[]> {
    const filterablePromises = this.map((o) => ({ accept: fn(o), value: o }));
    const filterables = await Promise.all(filterablePromises);
    return filterables.filter((o) => o.accept).map((o) => o.value);
}

if (!Array.prototype.choose) {
    Object.defineProperty(Array.prototype, 'choose', {
        enumerable: false,
        value: choose
    });
}

if (!Array.prototype.filterAsync) {
    Object.defineProperty(Array.prototype, 'filterAsync', {
        enumerable: false,
        value: filterAsync
    });
}
