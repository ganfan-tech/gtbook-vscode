import * as vscode from "vscode";
import * as fsp from "fs/promises";
import * as path from "path";

import { GTBook } from "./gtbook";
import { metaFile } from "./constants";
import { defaultGtbookYaml } from "./utils";

export class GTBookApp {
  private books = new Map<string, GTBook>();

  // 定义一个私有的发射器
  private _onDataChanged = new vscode.EventEmitter<GTBook | undefined>();
  // 暴露只读的事件给外部订阅
  readonly onDataChanged = this._onDataChanged.event;

  constructor(
    private workspaceFolders: readonly vscode.WorkspaceFolder[] | undefined,
  ) {
    this.loadBooks();
  }

  async loadBooks() {
    if (!this.workspaceFolders) {
      return;
    }

    for (let folder of this.workspaceFolders) {
      const folderPath = folder.uri.fsPath;
      const gtbook = await this.loadBookFromFS(folderPath);

      this.books.set(folderPath, gtbook);
    }

    this._onDataChanged.fire(undefined);
  }

  listBooks(): GTBook[] {
    return [...this.books.values()];
  }

  getBook(folderPath: string): GTBook | undefined {
    return this.books.get(folderPath);
  }

  async loadBookFromFS(folderPath: string) {
    const gtbookMetaPath = path.join(folderPath, metaFile);
    const gtbookMetaContent = await fsp.readFile(gtbookMetaPath, "utf-8");

    const gtbook = new GTBook(
      folderPath,
      gtbookMetaPath,
      this._onDataChanged,
      gtbookMetaContent,
    );

    return gtbook;
  }

  async newBook(bookDir: string, bookTitle: string) {
    await fsp.mkdir(bookDir, { recursive: true });
    const gtbookPath = path.join(bookDir, metaFile);
    await fsp.writeFile(gtbookPath, defaultGtbookYaml(bookTitle), "utf8");
  }
}
