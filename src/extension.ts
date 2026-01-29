// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { GTBookTOCProvider } from "./gtbook_toc";
import { NodeDependenciesProvider } from "./gtbook_assets";
import { GTBookService, metaFile } from "./gtbook_service";
import { Chapter } from "./types";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "gtbook-vscode" is now active!');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  const disposable = vscode.commands.registerCommand(
    "gtbook_toc.helloWorld",
    () => {
      // The code you place here will be executed every time your command is executed
      // Display a message box to the user
      vscode.window.showInformationMessage("Hello World from gtbook-vscode!");
    },
  );

  // view 2
  // const nodeDepsProvider = new NodeDependenciesProvider(rootPath);
  // vscode.window.registerTreeDataProvider("gtbook_assets", nodeDepsProvider);

  context.subscriptions.push(disposable);

  const rootPath =
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders.length > 0
      ? vscode.workspace.workspaceFolders[0].uri.fsPath
      : undefined;

  const gtbookService = new GTBookService(`${rootPath}/${metaFile}`); // 读取 book.yaml
  const gtbookTOCProvider = new GTBookTOCProvider(gtbookService);

  // // view 1
  vscode.window.registerTreeDataProvider("gtbook_toc", gtbookTOCProvider);

  const view = vscode.window.createTreeView("gtbook_toc", {
    treeDataProvider: gtbookTOCProvider,
    showCollapseAll: true,
    canSelectMany: true,
    dragAndDropController: gtbookTOCProvider,
  });

  const refreshCommand = vscode.commands.registerCommand(
    "gtbook_toc.refresh",
    () => gtbookTOCProvider.refresh(),
  );

  const newChapterCommand = vscode.commands.registerCommand(
    "gtbook_toc.newChapter",
    async (node: Chapter | undefined) => {
      const title = await vscode.window.showInputBox({
        title: "添加章节",
        value: "",
        prompt: "请输入新的章节标题",
        validateInput: (v) => (v.trim() ? null : "标题不能为空"),
      });

      if (!title) {
        return;
      }

      gtbookService.newChapter(node, title);
      gtbookTOCProvider.refresh();
    },
  );

  const deleteChapterCommand = vscode.commands.registerCommand(
    "gtbook_toc.deleteChapter",
    async (node: Chapter | undefined) => {
      if (!node) {
        return;
      }

      gtbookService.deleteChapter(node);
      gtbookTOCProvider.refresh();
    },
  );

  const openChapterCommand = vscode.commands.registerCommand(
    "gtbook_toc.openChapter",
    (node) => {
      if (!node.id) {
        return;
      }
      const uri = vscode.Uri.file(`${rootPath}/chapters/${node.id}.md`);
      vscode.window.showTextDocument(uri, {
        preview: true,
        preserveFocus: true,
      });
    },
  );

  const renameChapterCommand = vscode.commands.registerCommand(
    "gtbook_toc.renameChapter",
    async (node: Chapter) => {
      const title = await vscode.window.showInputBox({
        title: "重命名章节",
        value: node.title,
        prompt: "请输入新的章节标题",
        validateInput: (v) => (v.trim() ? null : "标题不能为空"),
      });

      if (!title) {
        return;
      }

      gtbookService.renameChapter(node.id, title);
      gtbookTOCProvider.refresh();
    },
  );

  const moveUpCommand = vscode.commands.registerCommand(
    "gtbook_toc.moveUp",
    (node: Chapter) => {
      gtbookService.moveUp(node);
      gtbookTOCProvider.refresh();
    },
  );
  const moveDownCommand = vscode.commands.registerCommand(
    "gtbook_toc.moveDown",
    (node: Chapter) => {
      gtbookService.moveDown(node);
      gtbookTOCProvider.refresh();
    },
  );

  context.subscriptions.push(refreshCommand);
  context.subscriptions.push(newChapterCommand);
  context.subscriptions.push(deleteChapterCommand);
  context.subscriptions.push(openChapterCommand);
  context.subscriptions.push(renameChapterCommand);
  context.subscriptions.push(moveUpCommand);
  context.subscriptions.push(moveDownCommand);
}

// This method is called when your extension is deactivated
export function deactivate() {}
