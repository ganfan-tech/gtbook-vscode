// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { GTBooksProvider } from "./gtbook_toc";
import { GTBooks } from "./gtbooks";
import { registerCommands } from "./commands";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "gtbook-vscode" is now active!');
  const gtbooks = new GTBooks(vscode.workspace.workspaceFolders);
  const gtbooksProvider = new GTBooksProvider(gtbooks);

  const gtbookExplorerTreeView = vscode.window.createTreeView(
    "gtbook_explorer",
    {
      treeDataProvider: gtbooksProvider,
      showCollapseAll: true,
      canSelectMany: true,
      dragAndDropController: gtbooksProvider,
    },
  );

  registerCommands(gtbookExplorerTreeView, gtbooksProvider, context);

  gtbooks.loadBooks().then(() => gtbooksProvider.refresh());
}

// This method is called when your extension is deactivated
export function deactivate() {}
