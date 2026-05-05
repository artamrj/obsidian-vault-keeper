import { App, Notice, PluginSettingTab, Setting, TFile, TFolder } from "obsidian";

import { normalizePath } from "../core/settings";
import type VaultKeeperPlugin from "../main";
import {
  IndexedProtectableItem,
  ProtectedPathSuggest,
} from "./ProtectedPathSuggest";

export class VaultKeeperSettingTab extends PluginSettingTab {
  plugin: VaultKeeperPlugin;

  constructor(app: App, plugin: VaultKeeperPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    this.renderSection(
      containerEl,
      "Behavior",
      "Choose how protected folders behave when something inside them is deleted.",
    );

    new Setting(containerEl)
      .setName("Block deleting folder contents")
      .setDesc(
        "When enabled, protected folders and everything inside them cannot be deleted.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(!this.plugin.settings.allowDeletingContents)
          .onChange((value) => {
            this.plugin.settings.allowDeletingContents = !value;
            void this.plugin.saveSettings();
          }),
      );

    this.renderSection(
      containerEl,
      "Add protection",
      "Search for an existing folder or file, then add it to the protected list.",
    );
    this.renderAddProtectedItem(containerEl);

    this.renderProtectedList(
      containerEl,
      "Protected folders",
      "Folders currently protected from deletion.",
      this.plugin.settings.protectedFolders,
      "folder",
    );

    this.renderProtectedList(
      containerEl,
      "Protected files",
      "Files currently protected from deletion.",
      this.plugin.settings.protectedFiles,
      "file",
    );

    const important = new Setting(containerEl)
      .setName("Important")
      .setDesc(
        "This only blocks deletion inside Obsidian. It cannot stop deletion from Finder, Explorer, Terminal, sync tools, or other apps.",
      );
    important.settingEl.addClass("vault-keeper-important");
  }

  private renderSection(
    containerEl: HTMLElement,
    title: string,
    description: string,
  ) {
    const section = new Setting(containerEl)
      .setName(title)
      .setDesc(description)
      .setHeading();

    section.settingEl.addClass("vault-keeper-section");
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
      .setName("Path")
      .setDesc(`Search ${items.length} folders and files.`)
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
          .onClick(() => {
            void addPath();
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
    description: string,
    paths: string[],
    type: "folder" | "file",
  ) {
    this.renderSection(
      containerEl,
      title,
      `${description} ${paths.length} ${paths.length === 1 ? "path" : "paths"} protected.`,
    );

    if (paths.length === 0) {
      new Setting(containerEl)
        .setName("Nothing protected yet")
        .setDesc(
          type === "folder" ? "No protected folders." : "No protected files.",
        );
      return;
    }

    paths.forEach((path) => {
      const removePath = async () => {
        if (type === "folder") await this.plugin.removeProtectedFolder(path);
        else await this.plugin.removeProtectedFile(path);
        this.display();
      };

      new Setting(containerEl)
        .setName(path)
        .setDesc(type)
        .addExtraButton((button) =>
          button
            .setIcon("trash-2")
            .setTooltip(`Remove ${path}`)
            .onClick(() => {
              void removePath();
            }),
        );
    });
  }
}
