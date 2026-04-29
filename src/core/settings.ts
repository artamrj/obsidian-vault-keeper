export interface VaultKeeperSettings {
  protectedFolders: string[];
  protectedFiles: string[];
  allowDeletingContents: boolean;
}

export const DEFAULT_SETTINGS: VaultKeeperSettings = {
  protectedFolders: [],
  protectedFiles: [],
  allowDeletingContents: false,
};

export function normalizePath(path: string): string {
  return path
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\\/g, "/");
}

export function cleanUnique(paths: string[]): string[] {
  return Array.from(new Set(paths.map(normalizePath).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b),
  );
}
