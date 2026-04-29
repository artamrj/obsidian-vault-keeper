import {
  AbstractInputSuggest,
  App,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TAbstractFile,
  TFile,
  TFolder,
} from "obsidian";

interface VaultKeeperSettings {
  protectedFolders: string[];
  protectedFiles: string[];
  allowDeletingContents: boolean;
}

const DEFAULT_SETTINGS: VaultKeeperSettings = {
  protectedFolders: [],
  protectedFiles: [],
  allowDeletingContents: false,
};

function normalizePath(path: string): string {
  return path
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\\/g, "/");
}

function cleanUnique(paths: string[]): string[] {
  return Array.from(new Set(paths.map(normalizePath).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b),
  );
}

type ProtectableItem = {
  file: TFile | TFolder;
  type: "file" | "folder";
};

type IndexedProtectableItem = ProtectableItem & {
  path: string;
  normalizedPath: string;
  searchable: string;
};

const SEARCH_RESULT_LIMIT = 25;

class ProtectedPathSuggest extends AbstractInputSuggest<IndexedProtectableItem> {
  constructor(
    app: App,
    inputEl: HTMLInputElement,
    private items: IndexedProtectableItem[],
    private isAlreadyProtected: (item: IndexedProtectableItem) => boolean,
    private onChoose: (item: IndexedProtectableItem) => void,
  ) {
    super(app, inputEl);
    this.limit = SEARCH_RESULT_LIMIT;
  }

  protected getSuggestions(query: string): IndexedProtectableItem[] {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return [];
    return this.items
      .filter((item) => item.searchable.includes(cleanQuery))
      .slice(0, SEARCH_RESULT_LIMIT);
  }

  renderSuggestion(item: IndexedProtectableItem, el: HTMLElement): void {
    el.createDiv({ text: item.path });
    el.createDiv({
      text: `${item.type === "folder" ? "Folder" : "File"}${this.isAlreadyProtected(item) ? " - Already protected" : ""}`,
      cls: "suggestion-note",
    });
  }

  selectSuggestion(
    item: IndexedProtectableItem,
    _evt?: MouseEvent | KeyboardEvent,
  ): void {
    this.setValue(item.path);
    this.onChoose(item);
    this.close();
  }
}

export default class VaultKeeperPlugin extends Plugin {
  settings: VaultKeeperSettings;

  private originalVaultDelete?: typeof this.app.vault.delete;
  private originalVaultTrash?: typeof this.app.vault.trash;
  private originalFileManagerTrashFile?: (file: TAbstractFile) => Promise<void>;
  private protectedFileSet = new Set<string>();
  private protectedFolderPaths: string[] = [];

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new VaultKeeperSettingTab(this.app, this));
    this.patchDeletionMethods();
  }

  onunload() {
    this.restoreDeletionMethods();
  }

  async loadSettings() {
    const loaded = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
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
    const targetPath = normalizePath(file.path);

    if (this.protectedFileSet.has(targetPath)) return true;

    return this.protectedFolderPaths.some((protectedPath) => {
      const isExactFolder = targetPath === protectedPath;
      const isInsideFolder = targetPath.startsWith(`${protectedPath}/`);

      if (this.settings.allowDeletingContents) {
        return file instanceof TFolder && isExactFolder;
      }
      return isExactFolder || isInsideFolder;
    });
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
    new Notice(`Vault Keeper blocked deletion: ${file.path}`);
    throw new Error(
      `Vault Keeper blocked deletion of protected path: ${file.path}`,
    );
  }

  private patchDeletionMethods() {
    const vault = this.app.vault;
    const fileManager = this.app.fileManager as typeof this.app.fileManager & {
      trashFile?: (file: TAbstractFile) => Promise<void>;
    };

    if (!this.originalVaultDelete) {
      this.originalVaultDelete = vault.delete.bind(
        vault,
      ) as typeof vault.delete;
      vault.delete = (async (
        file: TAbstractFile,
        force?: boolean,
      ): Promise<void> => {
        if (this.isProtected(file)) this.block(file);
        return this.originalVaultDelete!(file, force);
      }) as typeof vault.delete;
    }

    if (!this.originalVaultTrash) {
      this.originalVaultTrash = vault.trash.bind(vault) as typeof vault.trash;
      vault.trash = (async (
        file: TAbstractFile,
        system: boolean,
      ): Promise<void> => {
        if (this.isProtected(file)) this.block(file);
        return this.originalVaultTrash!(file, system);
      }) as typeof vault.trash;
    }

    if (fileManager.trashFile && !this.originalFileManagerTrashFile) {
      this.originalFileManagerTrashFile =
        fileManager.trashFile.bind(fileManager);
      fileManager.trashFile = async (file: TAbstractFile): Promise<void> => {
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
    const fileManager = this.app.fileManager as typeof this.app.fileManager & {
      trashFile?: (file: TAbstractFile) => Promise<void>;
    };
    if (this.originalFileManagerTrashFile && fileManager.trashFile) {
      fileManager.trashFile = this.originalFileManagerTrashFile;
      this.originalFileManagerTrashFile = undefined;
    }
  }
}

class VaultKeeperSettingTab extends PluginSettingTab {
  plugin: VaultKeeperPlugin;

  constructor(app: App, plugin: VaultKeeperPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Protection overview")
      .setDesc(
        "Protect folders and files from accidental deletion inside Obsidian.",
      )
      .setHeading();

    new Setting(containerEl)
      .setName("Block deleting folder contents")
      .setDesc(
        "When enabled, protected folders and everything inside them cannot be deleted.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(!this.plugin.settings.allowDeletingContents)
          .onChange(async (value) => {
            this.plugin.settings.allowDeletingContents = !value;
            await this.plugin.saveSettings();
          }),
      );

    this.renderAddProtectedItem(containerEl);

    this.renderProtectedList(
      containerEl,
      "Protected folders",
      this.plugin.settings.protectedFolders,
      "folder",
    );

    this.renderProtectedList(
      containerEl,
      "Protected files",
      this.plugin.settings.protectedFiles,
      "file",
    );

    const important = new Setting(containerEl)
      .setName("Important")
      .setDesc(
        "This only blocks deletion inside Obsidian. It cannot stop deletion from Finder, Explorer, terminal, sync tools, or other apps.",
      );

    important.settingEl.addClass("vault-keeper-important");
  }

  private renderAddProtectedItem(containerEl: HTMLElement) {
    const items = this.getProtectableItems();
    const protectedFolderSet = new Set(
      this.plugin.settings.protectedFolders.map(normalizePath),
    );
    const protectedFileSet = new Set(
      this.plugin.settings.protectedFiles.map(normalizePath),
    );
    let selectedPath = "";
    let inputEl: HTMLInputElement | undefined;

    const isAlreadyProtected = (item: IndexedProtectableItem) =>
      item.type === "folder"
        ? protectedFolderSet.has(item.normalizedPath)
        : protectedFileSet.has(item.normalizedPath);

    const findExactItem = (
      path: string,
    ): IndexedProtectableItem | undefined => {
      const cleanPath = normalizePath(path).toLowerCase();
      if (!cleanPath) return undefined;
      return items.find(
        (item) => item.normalizedPath.toLowerCase() === cleanPath,
      );
    };

    const addPath = async () => {
      const chosen = selectedPath || normalizePath(inputEl?.value ?? "");
      const item = findExactItem(chosen);
      if (!item) {
        new Notice("Choose an existing file or folder from the list.");
        return;
      }

      if (!item.path) {
        new Notice("Type a path first.");
        return;
      }

      if (isAlreadyProtected(item)) {
        new Notice(`${item.path} is already protected.`);
        return;
      }

      if (item.type === "folder") {
        await this.plugin.addProtectedFolder(item.path);
        new Notice(`Protected folder added: ${item.path}`);
      } else {
        await this.plugin.addProtectedFile(item.path);
        new Notice(`Protected file added: ${item.path}`);
      }

      this.display();
    };

    new Setting(containerEl)
      .setName("Add protected path")
      .setDesc(
        `Search ${items.length} folders and files, select a match, then protect it.`,
      )
      .addSearch((search) => {
        search.setPlaceholder("Search folders and files...");
        inputEl = search.inputEl;
        new ProtectedPathSuggest(
          this.app,
          search.inputEl,
          items,
          isAlreadyProtected,
          (item) => {
            selectedPath = item.path;
          },
        );
        search.onChange(() => {
          selectedPath = "";
        });
        search.inputEl.addEventListener("keydown", (event) => {
          if (event.key === "Enter") void addPath();
        });
      })
      .addButton((button) =>
        button
          .setButtonText("Add")
          .setCta()
          .onClick(async () => {
            await addPath();
          }),
      );
  }

  private getProtectableItems(): IndexedProtectableItem[] {
    return this.app.vault
      .getAllLoadedFiles()
      .filter((item): item is TFile | TFolder => {
        if (item instanceof TFolder) return item.path !== "/";
        return item instanceof TFile;
      })
      .map((file) => ({
        file,
        path: file.path,
        normalizedPath: normalizePath(file.path),
        searchable: `${file.path} ${file.name}`.toLowerCase(),
        type: file instanceof TFolder ? ("folder" as const) : ("file" as const),
      }))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
        return a.path.localeCompare(b.path);
      });
  }

  private renderProtectedList(
    containerEl: HTMLElement,
    title: string,
    paths: string[],
    type: "folder" | "file",
  ) {
    new Setting(containerEl)
      .setName(title)
      .setDesc(
        `${paths.length} ${paths.length === 1 ? "path" : "paths"} protected`,
      )
      .setHeading();

    if (paths.length === 0) {
      new Setting(containerEl)
        .setName("Nothing protected yet")
        .setDesc(
          type === "folder" ? "No protected folders." : "No protected files.",
        );
      return;
    }

    paths.forEach((path) => {
      new Setting(containerEl)
        .setName(path)
        .setDesc(type === "folder" ? "Folder" : "File")
        .addExtraButton((button) =>
          button
            .setIcon("trash-2")
            .setTooltip(`Remove ${path}`)
            .onClick(async () => {
              if (type === "folder")
                await this.plugin.removeProtectedFolder(path);
              else await this.plugin.removeProtectedFile(path);
              this.display();
            }),
        );
    });
  }
}
