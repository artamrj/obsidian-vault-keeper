import { TAbstractFile, TFolder } from "obsidian";

import blockedDeletionMessages from "./blockedDeletionMessages.json";
import { normalizePath, VaultKeeperSettings } from "./settings";

const blockedDeletionMessageTemplates: string[] = blockedDeletionMessages;

export function isProtectedPath(
  file: TAbstractFile,
  settings: VaultKeeperSettings,
  protectedFileSet: Set<string>,
  protectedFolderPaths: string[],
): boolean {
  const targetPath = normalizePath(file.path);

  if (protectedFileSet.has(targetPath)) return true;

  return protectedFolderPaths.some((protectedPath) => {
    const isExactFolder = targetPath === protectedPath;
    const isInsideFolder = targetPath.startsWith(`${protectedPath}/`);

    if (settings.allowDeletingContents) {
      return file instanceof TFolder && isExactFolder;
    }

    return isExactFolder || isInsideFolder;
  });
}

export function getBlockedDeletionMessage(
  file: TAbstractFile,
  previousMessage?: string,
): string {
  const messages = blockedDeletionMessageTemplates.filter(
    (message) => message !== previousMessage,
  );
  const pool =
    messages.length > 0 ? messages : blockedDeletionMessageTemplates;
  const template = pool[Math.floor(Math.random() * pool.length)];

  return template.replace("{path}", file.path);
}
