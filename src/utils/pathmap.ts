// We need this instead of a normal Map<string, T> because sometimes VS Code likes to
// mix it up in terms of / and \ even within a single file path.  And also uses inconsistent
// casing for drive letters and sometimes even file names on Windows.
export class PathMap<T> {
    private readonly _impl = new Map<string, T>();

    private normalise(path: string) {
        return path.replace(/\\/g, '/').toLowerCase();  // TODO: This is rude on Linux, but the casing seems to mess us up on Windows
    }

    get(path: string) {
        return this._impl.get(this.normalise(path));
    }

    set(path: string, value: T) {
        return this._impl.set(this.normalise(path), value);
    }

    delete(path: string) {
        return this._impl.delete(this.normalise(path));
    }
}

export class PathMapList<T> {
    private readonly _impl = new PathMap<T[]>();

    get(path: string) {
        return this._impl.get(path);
    }

    append(path: string, value: T) {
        const existing = this.get(path);
        if (existing) {
            existing.push(value);
        } else {
            this._impl.set(path, [value]);
        }
        return this;
    }

    delete(path: string) {
        return this._impl.delete(path);
    }
}
