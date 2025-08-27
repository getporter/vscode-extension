import * as sysfs from 'fs';
import { mkdirp } from 'mkdirp';
import { promisify } from 'util';

export const fs = {
    copyFile: promisify(sysfs.copyFile),
    exists: promisify(sysfs.exists),
    mkdir: promisify(sysfs.mkdir),
    mkdirp: promisify(mkdirp),
    readFile: promisify(sysfs.readFile),
    unlink: promisify(sysfs.unlink),
    writeFile: promisify(sysfs.writeFile),
};
