import { Notice, Plugin, TAbstractFile } from "obsidian";

import {
  getBlockedDeletionMessage,
  isProtectedPath,
} from "./core/protection";
import {
  cleanUnique,
  DEFAULT_SETTINGS,
  normalizePath,
  VaultKeeperSettings,
} from "./core/settings";
import { VaultKeeperSettingTab } from "./settings/VaultKeeperSettingTab";

type VaultDelete = (file: TAbstractFile, force?: boolean) => Promise<void>;
type VaultTrash = (file: TAbstractFile, system: boolean) => Promise<void>;
type FileManagerTrashFile = (file: TAbstractFile) => Promise<void>;

export default class VaultKeeperPlugin extends Plugin {
  settings: VaultKeeperSettings;

  private originalVaultDelete?: VaultDelete;
  private originalVaultTrash?: VaultTrash;
  private originalFileManagerTrashFile?: FileManagerTrashFile;
  private protectedFileSet = new Set<string>();
  private protectedFolderPaths: string[] = [];
  private lastBlockedDeletionMessage?: string;

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new VaultKeeperSettingTab(this.app, this));
    this.patchDeletionMethods();
  }

  onunload() {
    this.restoreDeletionMethods();
  }

  async loadSettings() {
    const loaded = (await this.loadData()) as Partial<VaultKeeperSettings> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...loaded };
    this.settings.protectedFolders = cleanUnique(
      this.settings.protectedFolders ?? [],
    );
    this.settings.protectedFiles = cleanUnique(
      this.settings.protectedFiles ?? [],
    );
    this.settings.allowDeletingContents = Boolean(
      this.settings.allowDeletingContents,
    );
    this.refreshProtectionIndex();
  }

  async saveSettings() {
    this.settings.protectedFolders = cleanUnique(
      this.settings.protectedFolders,
    );
    this.settings.protectedFiles = cleanUnique(this.settings.protectedFiles);
    this.refreshProtectionIndex();
    await this.saveData(this.settings);
  }

  async addProtectedFolder(path: string) {
    const clean = normalizePath(path);
    if (!clean) return;
    this.settings.protectedFolders = cleanUnique([
      ...this.settings.protectedFolders,
      clean,
    ]);
    await this.saveSettings();
  }

  async addProtectedFile(path: string) {
    const clean = normalizePath(path);
    if (!clean) return;
    this.settings.protectedFiles = cleanUnique([
      ...this.settings.protectedFiles,
      clean,
    ]);
    await this.saveSettings();
  }

  async removeProtectedFolder(path: string) {
    const clean = normalizePath(path);
    this.settings.protectedFolders = this.settings.protectedFolders.filter(
      (p) => p !== clean,
    );
    await this.saveSettings();
  }

  async removeProtectedFile(path: string) {
    const clean = normalizePath(path);
    this.settings.protectedFiles = this.settings.protectedFiles.filter(
      (p) => p !== clean,
    );
    await this.saveSettings();
  }

  isProtected(file: TAbstractFile): boolean {
    return isProtectedPath(
      file,
      this.settings,
      this.protectedFileSet,
      this.protectedFolderPaths,
    );
  }

  private refreshProtectionIndex() {
    this.protectedFileSet = new Set(
      this.settings.protectedFiles.map(normalizePath),
    );
    this.protectedFolderPaths = this.settings.protectedFolders
      .map(normalizePath)
      .filter(Boolean);
  }

  private block(file: TAbstractFile): never {
    const message = getBlockedDeletionMessage(
      file,
      this.lastBlockedDeletionMessage,
    );
    this.lastBlockedDeletionMessage = message;
    new Notice(message);
    throw new Error(
      `Vault Keeper blocked deletion of protected path: ${file.path}`,
    );
  }

  private patchDeletionMethods() {
    if (!this.originalVaultDelete) {
      this.originalVaultDelete = this.app.vault.delete.bind(
        this.app.vault,
      );
      this.app.vault.delete = async (
        file: TAbstractFile,
        force?: boolean,
      ): Promise<void> => {
        if (this.isProtected(file)) this.block(file);
        return this.originalVaultDelete!(file, force);
      };
    }

    if (!this.originalVaultTrash) {
      this.originalVaultTrash = this.app.vault.trash.bind(
        this.app.vault,
      );
      this.app.vault.trash = async (
        file: TAbstractFile,
        system: boolean,
      ): Promise<void> => {
        if (this.isProtected(file)) this.block(file);
        return this.originalVaultTrash!(file, system);
      };
    }

    if (
      this.app.fileManager.trashFile &&
      !this.originalFileManagerTrashFile
    ) {
      this.originalFileManagerTrashFile = this.app.fileManager.trashFile.bind(
        this.app.fileManager,
      );
      this.app.fileManager.trashFile = async (
        file: TAbstractFile,
      ): Promise<void> => {
        if (this.isProtected(file)) this.block(file);
        return this.originalFileManagerTrashFile!(file);
      };
    }
  }

  private restoreDeletionMethods() {
    if (this.originalVaultDelete) {
      this.app.vault.delete = this.originalVaultDelete;
      this.originalVaultDelete = undefined;
    }
    if (this.originalVaultTrash) {
      this.app.vault.trash = this.originalVaultTrash;
      this.originalVaultTrash = undefined;
    }
    if (
      this.originalFileManagerTrashFile &&
      this.app.fileManager.trashFile
    ) {
      this.app.fileManager.trashFile = this.originalFileManagerTrashFile;
      this.originalFileManagerTrashFile = undefined;
    }
  }
}
