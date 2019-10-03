import * as sysfs from 'fs';
import mkdirp = require('mkdirp');
import { promisify } from 'util';

export const fs = {
    copyFile: promisify(sysfs.copyFile),
    exists: promisify(sysfs.exists),
    mkdir: promisify(sysfs.mkdir),
    mkdirp: promisify((path: string, cb: (err: NodeJS.ErrnoException, made: mkdirp.Made) => void) => mkdirp(path, cb)),
    readFile: promisify(sysfs.readFile),
    unlink: promisify(sysfs.unlink),
    writeFile: promisify(sysfs.writeFile),
};
