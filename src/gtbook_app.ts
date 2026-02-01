import * as vscode from "vscode";
import * as fsp from "fs/promises";
import * as path from "path";

import { GTBook } from "./gtbook";
import { metaFile } from "./constants";

export class GTBookApp {
  private books = new Map<string, GTBook>();

  constructor(
    private workspaceFolders: readonly vscode.WorkspaceFolder[] | undefined,
  ) {}

  async loadBooks() {
    if (!this.workspaceFolders) {
      return;
    }

    for (let folder of this.workspaceFolders) {
      const folderPath = folder.uri.fsPath;
      const gtbookMetaPath = path.join(folderPath, metaFile);
      const gtbookMetaContent = await fsp.readFile(gtbookMetaPath, "utf-8");

      const gtbook = new GTBook(folderPath, gtbookMetaPath, gtbookMetaContent);

      this.books.set(folderPath, gtbook);
    }
  }

  listBooks(): GTBook[] {
    return [...this.books.values()];
  }

  getBook(folderPath: string): GTBook | undefined {
    return this.books.get(folderPath);
  }
}
