import { AbstractInputSuggest, App, TFile, TFolder } from "obsidian";

export type ProtectableItem = {
  file: TFile | TFolder;
  type: "file" | "folder";
};

export type IndexedProtectableItem = ProtectableItem & {
  path: string;
  normalizedPath: string;
  searchable: string;
};

const SEARCH_RESULT_LIMIT = 25;

export class ProtectedPathSuggest extends AbstractInputSuggest<IndexedProtectableItem> {
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
      text: `${item.type}${this.isAlreadyProtected(item) ? " - already protected" : ""}`,
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
