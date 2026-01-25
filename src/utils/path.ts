import { normalizePath } from "obsidian";

export function getDir(path: string): string {
    const normalized = normalizePath(path);
    const lastIndex = normalized.lastIndexOf('/');
    if(lastIndex === -1) return '/';
    const dir = normalized.slice(0, lastIndex);
    return dir.length === 0
            ? '/' : dir;
}

export function pathBasename(path: string) {
	const normalized = normalizePath(path);
    const lastIndex = normalized.lastIndexOf('/');
    if(lastIndex === -1) return path;
	return path.slice(lastIndex + 1);
}
