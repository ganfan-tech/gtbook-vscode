import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";
import { GTBookService } from "./gtbook_service";
import { Chapter } from "./types";

const metaFile = "gtbook.yaml";

export class GTBookTOCProvider
  implements
    vscode.TreeDataProvider<Chapter>,
    vscode.TreeDragAndDropController<Chapter>
{
  dropMimeTypes = [
    "application/vnd.code.tree.dragAndDropPosition",
    "application/vnd.code.tree.gtbook_toc",
  ];
  dragMimeTypes = ["text/uri-list"];

  private _onDidChangeTreeData: vscode.EventEmitter<
    (Chapter | undefined)[] | undefined
  > = new vscode.EventEmitter<(Chapter | undefined)[] | undefined>();
  // We want to use an array as the event type, but the API for this is currently being finalized. Until it's finalized, use any.
  public onDidChangeTreeData: vscode.Event<any> =
    this._onDidChangeTreeData.event;

  public refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  constructor(private gtbookService: GTBookService) {}

  getTreeItem(chapter: Chapter): vscode.TreeItem {
    const item = new ChapterItem(chapter);

    item.command = {
      command: "gtbook_toc.openChapter",
      title: "Open Chapter",
      arguments: [chapter],
    };

    return item;
  }

  getChildren(chapter?: Chapter): Thenable<Chapter[]> {
    // 根目录
    if (!chapter) {
      return Promise.resolve(this.gtbookService.getTree());
    }

    // 子目录
    return Promise.resolve(chapter.chapters);
  }

  public async handleDrop(
    target: Chapter | undefined,
    dataTransfer: vscode.DataTransfer,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    const transferItem = dataTransfer.get(
      "application/vnd.code.tree.gtbook_toc",
    );
    if (!transferItem) {
      return;
    }

    const isShiftPressed = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.options.cursorStyle // 兼容写法
      : false;
    console.log("isShiftPressed", isShiftPressed);
    dataTransfer.forEach((value, key) => {
      console.log(key, value);
    });
    const treeItems: Chapter[] = transferItem.value;
    const positionItem = dataTransfer.get(
      "application/vnd.code.tree.dragAndDropPosition",
    );
    console.log("positionItem", positionItem);
    this.gtbookService.moveChapters(target, treeItems);
    this._onDidChangeTreeData.fire(undefined);
  }

  public async handleDrag(
    source: Chapter[],
    dataTransfer: vscode.DataTransfer,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    console.log("22343234");

    console.log(source);
    dataTransfer.set(
      "application/vnd.code.tree.gtbook_toc",
      new vscode.DataTransferItem(source),
    );
  }
}

class ChapterItem extends vscode.TreeItem {
  constructor(public node: Chapter) {
    super(
      node.title,
      node.chapters?.length > 0
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None,
    );
    this.id = node.id;
    this.contextValue = "chapter";
    this.tooltip = `${this.label}-${this.id}`;
  }
}
