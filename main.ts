import {
  App,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  setIcon,
  TAbstractFile,
  TFile,
  TFolder,
} from "obsidian";

interface FolderGuardSettings {
  protectedFolders: string[];
  protectedFiles: string[];
  allowDeletingContents: boolean;
}

const DEFAULT_SETTINGS: FolderGuardSettings = {
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
  return Array.from(new Set(paths.map(normalizePath).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
}

type ProtectableItem = {
  file: TFile | TFolder;
  type: "file" | "folder";
};

export default class FolderGuardPlugin extends Plugin {
  settings: FolderGuardSettings;

  private originalVaultDelete?: typeof this.app.vault.delete;
  private originalVaultTrash?: typeof this.app.vault.trash;
  private originalFileManagerTrashFile?: (file: TAbstractFile) => Promise<void>;

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new FolderGuardSettingTab(this.app, this));
    this.patchDeletionMethods();
    this.addCommand({
      id: "show-protected-items",
      name: "Show protected items",
      callback: () => {
        const folders = this.settings.protectedFolders.join(", ") || "none";
        const files = this.settings.protectedFiles.join(", ") || "none";
        new Notice(`Protected folders: ${folders}\nProtected files: ${files}`);
      },
    });
  }

  onunload() {
    this.restoreDeletionMethods();
  }

  async loadSettings() {
    const loaded = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
    this.settings.protectedFolders = cleanUnique(this.settings.protectedFolders ?? []);
    this.settings.protectedFiles = cleanUnique(this.settings.protectedFiles ?? []);
    this.settings.allowDeletingContents = Boolean(this.settings.allowDeletingContents);
  }

  async saveSettings() {
    this.settings.protectedFolders = cleanUnique(this.settings.protectedFolders);
    this.settings.protectedFiles = cleanUnique(this.settings.protectedFiles);
    await this.saveData(this.settings);
  }

  async addProtectedFolder(path: string) {
    const clean = normalizePath(path);
    if (!clean) return;
    this.settings.protectedFolders = cleanUnique([...this.settings.protectedFolders, clean]);
    await this.saveSettings();
  }

  async addProtectedFile(path: string) {
    const clean = normalizePath(path);
    if (!clean) return;
    this.settings.protectedFiles = cleanUnique([...this.settings.protectedFiles, clean]);
    await this.saveSettings();
  }

  async removeProtectedFolder(path: string) {
    const clean = normalizePath(path);
    this.settings.protectedFolders = this.settings.protectedFolders.filter((p) => p !== clean);
    await this.saveSettings();
  }

  async removeProtectedFile(path: string) {
    const clean = normalizePath(path);
    this.settings.protectedFiles = this.settings.protectedFiles.filter((p) => p !== clean);
    await this.saveSettings();
  }

  isProtected(file: TAbstractFile): boolean {
    const targetPath = normalizePath(file.path);

    const exactFileProtected = this.settings.protectedFiles.some(
      (protectedFile) => targetPath === normalizePath(protectedFile)
    );
    if (exactFileProtected) return true;

    return this.settings.protectedFolders.some((folder) => {
      const protectedPath = normalizePath(folder);
      if (!protectedPath) return false;

      const isExactFolder = targetPath === protectedPath;
      const isInsideFolder = targetPath.startsWith(`${protectedPath}/`);

      if (this.settings.allowDeletingContents) {
        return file instanceof TFolder && isExactFolder;
      }
      return isExactFolder || isInsideFolder;
    });
  }

  private block(file: TAbstractFile): never {
    new Notice(`Folder Guard blocked deletion: ${file.path}`);
    throw new Error(`Folder Guard blocked deletion of protected path: ${file.path}`);
  }

  private patchDeletionMethods() {
    const plugin = this;
    const vault = this.app.vault;
    const fileManager = this.app.fileManager as typeof this.app.fileManager & {
      trashFile?: (file: TAbstractFile) => Promise<void>;
    };

    if (!this.originalVaultDelete) {
      this.originalVaultDelete = vault.delete.bind(vault) as typeof vault.delete;
      vault.delete = async function (file: TAbstractFile, force?: boolean): Promise<void> {
        if (plugin.isProtected(file)) plugin.block(file);
        return plugin.originalVaultDelete!(file, force);
      } as typeof vault.delete;
    }

    if (!this.originalVaultTrash) {
      this.originalVaultTrash = vault.trash.bind(vault) as typeof vault.trash;
      vault.trash = async function (file: TAbstractFile, system: boolean): Promise<void> {
        if (plugin.isProtected(file)) plugin.block(file);
        return plugin.originalVaultTrash!(file, system);
      } as typeof vault.trash;
    }

    if (fileManager.trashFile && !this.originalFileManagerTrashFile) {
      this.originalFileManagerTrashFile = fileManager.trashFile.bind(fileManager);
      fileManager.trashFile = async function (file: TAbstractFile): Promise<void> {
        if (plugin.isProtected(file)) plugin.block(file);
        return plugin.originalFileManagerTrashFile!(file);
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

class FolderGuardSettingTab extends PluginSettingTab {
  plugin: FolderGuardPlugin;

  constructor(app: App, plugin: FolderGuardPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("folder-guard-settings");

    const hero = containerEl.createDiv({ cls: "folder-guard-hero" });
    const heroIcon = hero.createDiv({ cls: "folder-guard-hero-icon" });
    setIcon(heroIcon, "shield-check");
    const heroCopy = hero.createDiv();
    heroCopy.createEl("h2", { text: "Vault Keeper" });
    heroCopy.createEl("p", {
      text: "Protect folders and files from accidental deletion inside Obsidian.",
      cls: "setting-item-description",
    });

    new Setting(containerEl)
      .setName("Block deleting folder contents")
      .setDesc("When enabled, protected folders and everything inside them cannot be deleted.")
      .addToggle((toggle) =>
        toggle.setValue(!this.plugin.settings.allowDeletingContents).onChange(async (value) => {
          this.plugin.settings.allowDeletingContents = !value;
          await this.plugin.saveSettings();
        })
      );

    this.renderAddProtectedItem(containerEl);
    this.renderProtectedList(containerEl, "Protected folders", this.plugin.settings.protectedFolders, "folder");
    this.renderProtectedList(containerEl, "Protected files", this.plugin.settings.protectedFiles, "file");

    const note = containerEl.createDiv({ cls: "folder-guard-note" });
    const noteIcon = note.createDiv({ cls: "folder-guard-note-icon" });
    setIcon(noteIcon, "info");
    note.createEl("p", {
      text: "This blocks deletion only inside Obsidian. It cannot stop deletion from Finder, Explorer, terminal, sync tools, or other apps.",
      cls: "setting-item-description",
    });
  }

  private renderAddProtectedItem(containerEl: HTMLElement) {
    const wrap = containerEl.createDiv({ cls: "folder-guard-card" });
    const header = wrap.createDiv({ cls: "folder-guard-card-header" });
    const titleWrap = header.createDiv();
    titleWrap.createEl("h3", { text: "Add protected path" });
    titleWrap.createEl("p", {
      text: "Type a folder or file name, select a match, then add it.",
      cls: "setting-item-description",
    });
    const countPill = header.createDiv({ cls: "folder-guard-count-pill" });
    setIcon(countPill.createSpan(), "database");
    countPill.createSpan({ text: `${this.getProtectableItems().length} items` });

    const row = wrap.createDiv({ cls: "folder-guard-row" });
    const input = row.createEl("input", {
      type: "text",
      placeholder: "Archive or Uni/exam.md",
      cls: "folder-guard-input",
    });
    const addButton = row.createEl("button", { cls: "mod-cta folder-guard-add-button" });
    setIcon(addButton.createSpan(), "plus");
    addButton.createSpan({ text: "Add" });
    const preview = wrap.createDiv({ cls: "folder-guard-preview" });
    let selectedPath = "";

    const items = this.getProtectableItems();

    const findExactItem = (path: string): ProtectableItem | undefined => {
      const cleanPath = normalizePath(path).toLowerCase();
      if (!cleanPath) return undefined;
      return items.find((item) => item.file.path.toLowerCase() === cleanPath);
    };

    const renderPreview = () => {
      const query = input.value.trim().toLowerCase();
      preview.empty();

      if (!query) {
        const empty = preview.createDiv({ cls: "folder-guard-empty" });
        setIcon(empty.createDiv({ cls: "folder-guard-empty-icon" }), "search");
        empty.createDiv({ text: "Start typing to preview matching folders and files." });
        return;
      }

      const matches = items
        .filter((item) => {
          const path = item.file.path.toLowerCase();
          const name = item.file.name.toLowerCase();
          return path.includes(query) || name.includes(query);
        })
        .slice(0, 20);

      if (matches.length === 0) {
        const empty = preview.createDiv({ cls: "folder-guard-empty" });
        setIcon(empty.createDiv({ cls: "folder-guard-empty-icon" }), "file-question");
        empty.createDiv({ text: "No existing file or folder matches this path." });
        selectedPath = "";
        return;
      }

      const list = preview.createDiv({ cls: "folder-guard-preview-list" });
      matches.forEach((item) => {
        const isSelected = item.file.path === selectedPath;
        const isAlreadyProtected =
          item.type === "folder"
            ? this.plugin.settings.protectedFolders.includes(item.file.path)
            : this.plugin.settings.protectedFiles.includes(item.file.path);
        const button = list.createEl("button", {
          cls: `folder-guard-preview-row${isSelected ? " is-selected" : ""}`,
        });
        button.type = "button";
        const icon = button.createDiv({ cls: "folder-guard-item-icon" });
        setIcon(icon, item.type === "folder" ? "folder" : "file-text");
        const textWrap = button.createDiv({ cls: "folder-guard-item-main" });
        textWrap.createEl("code", { text: item.file.path });
        const meta = textWrap.createDiv({ cls: "folder-guard-item-meta" });
        meta.createSpan({ text: item.type === "folder" ? "Folder" : "File" });
        if (isAlreadyProtected) meta.createSpan({ text: "Already protected" });
        const action = button.createDiv({ cls: "folder-guard-preview-action" });
        setIcon(action, isSelected ? "check" : "arrow-right");
        button.addEventListener("click", () => {
          selectedPath = item.file.path;
          input.value = item.file.path;
          renderPreview();
        });
      });
    };

    const addPath = async () => {
      const chosen = selectedPath || normalizePath(input.value);
      const item = findExactItem(chosen);
      if (!item) {
        new Notice("Choose an existing file or folder from the list.");
        renderPreview();
        return;
      }

      if (!item.file.path) {
        new Notice("Type a path first.");
        return;
      }

      if (item.type === "folder") {
        await this.plugin.addProtectedFolder(item.file.path);
        new Notice(`Protected folder added: ${item.file.path}`);
      } else {
        await this.plugin.addProtectedFile(item.file.path);
        new Notice(`Protected file added: ${item.file.path}`);
      }

      this.display();
    };

    input.addEventListener("input", () => {
      selectedPath = "";
      renderPreview();
    });
    addButton.addEventListener("click", async () => {
      await addPath();
    });
    input.addEventListener("keydown", async (event) => {
      if (event.key === "Enter") await addPath();
    });
    renderPreview();
  }

  private getProtectableItems(): ProtectableItem[] {
    return this.app.vault
      .getAllLoadedFiles()
      .filter((item): item is TFile | TFolder => {
        if (item instanceof TFolder) return item.path !== "/";
        return item instanceof TFile;
      })
      .map((file) => ({
        file,
        type: file instanceof TFolder ? ("folder" as const) : ("file" as const),
      }))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
        return a.file.path.localeCompare(b.file.path);
      });
  }

  private renderProtectedList(
    containerEl: HTMLElement,
    title: string,
    paths: string[],
    type: "folder" | "file"
  ) {
    const card = containerEl.createDiv({ cls: "folder-guard-card" });
    const header = card.createDiv({ cls: "folder-guard-card-header" });
    header.createEl("h3", { text: title });
    header.createDiv({ text: `${paths.length}`, cls: "folder-guard-count-pill" });

    if (paths.length === 0) {
      const empty = card.createDiv({ cls: "folder-guard-empty" });
      setIcon(empty.createDiv({ cls: "folder-guard-empty-icon" }), type === "folder" ? "folder-open" : "file");
      empty.createDiv({ text: "Nothing protected yet." });
      return;
    }

    const list = card.createDiv({ cls: "folder-guard-list" });
    paths.forEach((path) => {
      const row = list.createDiv({ cls: "folder-guard-list-row" });
      const icon = row.createDiv({ cls: "folder-guard-item-icon" });
      setIcon(icon, type === "folder" ? "folder-lock" : "file-lock-2");
      const textWrap = row.createDiv({ cls: "folder-guard-item-main" });
      textWrap.createEl("code", { text: path });
      textWrap.createDiv({ text: type === "folder" ? "Folder" : "File", cls: "folder-guard-item-meta" });
      const removeButton = row.createEl("button", { cls: "folder-guard-icon-button" });
      removeButton.ariaLabel = `Remove ${path}`;
      setIcon(removeButton, "trash-2");
      removeButton.addEventListener("click", async () => {
        if (type === "folder") await this.plugin.removeProtectedFolder(path);
        else await this.plugin.removeProtectedFile(path);
        this.display();
      });
    });
  }
}
