import * as vscode from "vscode";
import { GTBook } from "./gtbook";
import { GTBookApp } from "./gtbook_app";
import { Chapter } from "./types";

export class GTBookProvider
  implements
    vscode.TreeDataProvider<TreeItemNode>,
    vscode.TreeDragAndDropController<TreeItemNode>
{
  dropMimeTypes = ["application/vnd.code.tree.gtbook_explorer"];
  dragMimeTypes = ["application/vnd.code.tree.gtbook_explorer"];

  private _onDidChangeTreeData: vscode.EventEmitter<
    (TreeItemNode | undefined)[] | undefined
  > = new vscode.EventEmitter<(TreeItemNode | undefined)[] | undefined>();
  // We want to use an array as the event type, but the API for this is currently being finalized. Until it's finalized, use any.
  public onDidChangeTreeData: vscode.Event<any> =
    this._onDidChangeTreeData.event;

  public refresh(node?: TreeItemNode): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  constructor(public gtbookApp: GTBookApp) {}

  getTreeItem(element: TreeItemNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeItemNode) {
    // 根节点：workspace folders
    if (!element) {
      return this.gtbookApp.listBooks().map((gtbook) => new BookNode(gtbook));
    }

    // folder 下的章节
    if (element instanceof BookNode) {
      return element.gtbook
        .getTree()
        .map((chapter) => new ChapterNode(element.gtbook, chapter));
    }

    // chapter 下的章节
    if (element instanceof ChapterNode) {
      return element.chapter.chapters?.map(
        (chapter) => new ChapterNode(element.gtbook, chapter),
      );
    }

    return [];
  }

  getParent(element: TreeItemNode): vscode.ProviderResult<TreeItemNode> {
    if (element instanceof BookNode) {
      return undefined;
    }

    if (element instanceof ChapterNode) {
      const gtbook = this.gtbookApp.getBook(element.gtbook.folderPath);
      if (!gtbook) {
        return;
      }
      const parentChapter = gtbook.getParent(element.chapter);
      if (!parentChapter) {
        return new BookNode(element.gtbook);
      } else {
        return new ChapterNode(element.gtbook, parentChapter);
      }
    }

    return undefined;
  }

  public async handleDrop(
    target: TreeItemNode | undefined,
    dataTransfer: vscode.DataTransfer,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    const transferItem = dataTransfer.get(
      "application/vnd.code.tree.gtbook_explorer",
    );
    if (!transferItem) {
      return;
    }
    if (!target) {
      return;
    }

    const raw = await transferItem.asString();
    const items = JSON.parse(raw) as Array<{
      kind: string;
      folderPath: string;
      id?: string;
    }>;

    let targetBookFolderPath = target.gtbook.folderPath;
    const isSameBook = items.every(
      (item) => item.folderPath === targetBookFolderPath,
    );
    if (!isSameBook) {
      vscode.window.showInformationMessage(`Cannot move chapters across books`);
      return;
    }

    const targetBook = this.gtbookApp.getBook(targetBookFolderPath);
    if (!targetBook) {
      return;
    }

    const chapters = items
      .filter((item) => item.kind === "chapter")
      .map((item) => item.id as string);

    if (target instanceof BookNode) {
      targetBook.moveChapters(undefined, chapters);
    } else if (target instanceof ChapterNode) {
      targetBook.moveChapters(target.chapter, chapters);
    }

    this._onDidChangeTreeData.fire(undefined);
  }

  public async handleDrag(
    source: TreeItemNode[],
    dataTransfer: vscode.DataTransfer,
  ) {
    const payload = source.map((s) =>
      s instanceof ChapterNode
        ? {
            kind: "chapter",
            folderPath: s.gtbook.folderPath,
            id: s.chapter.id,
          }
        : {
            kind: "book",
            folderPath: s.gtbook.folderPath,
          },
    );
    dataTransfer.set(
      "application/vnd.code.tree.gtbook_explorer",
      new vscode.DataTransferItem(JSON.stringify(payload)),
    );
  }
}

export type TreeItemNode = BookNode | ChapterNode;

export class BookNode extends vscode.TreeItem {
  constructor(public readonly gtbook: GTBook) {
    super(gtbook.meta.title, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = "gtbook.book";

    this.iconPath = new vscode.ThemeIcon("book");
  }
}

export class ChapterNode extends vscode.TreeItem {
  constructor(
    public readonly gtbook: GTBook,
    public readonly chapter: Chapter,
  ) {
    super(
      chapter.title,
      chapter.chapters?.length > 0
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None,
    );
    this.contextValue = "gtbook.chapter";

    this.command = {
      command: "gtbook_explorer.openChapter",
      title: "Open Chapter",
      arguments: [this],
    };

    this.tooltip = `${this.gtbook.meta.title}-${this.label}`;
  }
}
