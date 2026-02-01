// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { GTBookProvider } from "./gtbook_provider";
import { GTBookApp } from "./gtbook_app";
import { registerCommands } from "./gtbook_commands";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "gtbook-vscode" is now active!');
  const gtbookApp = new GTBookApp(vscode.workspace.workspaceFolders);
  const gtbookProvider = new GTBookProvider(gtbookApp);

  const gtbookExplorerTreeView = vscode.window.createTreeView(
    "gtbook_explorer",
    {
      treeDataProvider: gtbookProvider,
      showCollapseAll: true,
      canSelectMany: true,
      dragAndDropController: gtbookProvider,
    },
  );

  registerCommands(gtbookExplorerTreeView, gtbookProvider, context);

  gtbookApp.loadBooks().then(() => gtbookProvider.refresh());
}

// This method is called when your extension is deactivated
export function deactivate() {}
