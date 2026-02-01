// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import {
  BookNode,
  GTBookProvider,
  TreeItemNode,
  ChapterNode,
} from "./gtbook_provider";
import path from "path";
import * as fsp from "fs/promises";
import { INVALID_CHARS_REGEX, metaFile } from "./constants";
import { exists, defaultGtbookYaml } from "./utils";

export const registerCommands = (
  gtbookExplorerTreeView: vscode.TreeView<TreeItemNode>,
  gtbookProvider: GTBookProvider,
  context: vscode.ExtensionContext,
) => {
  const gtbookApp = gtbookProvider.gtbookApp;

  const refreshCommand = vscode.commands.registerCommand(
    "gtbook_explorer.refresh",
    () => gtbookProvider.refresh(),
  );

  const newChapterCommand = vscode.commands.registerCommand(
    "gtbook_explorer.newChapter",
    async (node: TreeItemNode) => {
      let title = await vscode.window.showInputBox({
        title: "Create Chapter",
        value: "",
        prompt: "Enter the title of the new chapter",
        validateInput: (v) =>
          v.trim() ? null : "Chapter title cannot be empty",
      });

      if (!title) {
        return;
      }
      title = title.trim();

      if (!node) {
        return;
      }

      const gtbook = gtbookApp.getBook(node.gtbook.folderPath);
      if (!gtbook) {
        return;
      }

      if (node instanceof BookNode) {
        gtbook.newChapter(undefined, title);
      } else {
        gtbook.newChapter(node.chapter, title);
      }

      node.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
      gtbookProvider.refresh(node);

      await gtbookExplorerTreeView.reveal(node, {
        expand: true,
        focus: false,
        select: false,
      });
    },
  );

  const deleteChapterCommand = vscode.commands.registerCommand(
    "gtbook_explorer.deleteChapter",
    async (node: ChapterNode) => {
      if (!node) {
        return;
      }

      if (node instanceof BookNode) {
        return;
      }

      const gtbook = gtbookApp.getBook(node.gtbook.folderPath);
      if (!gtbook) {
        return;
      }

      gtbook.deleteChapter(node.chapter);
      gtbookProvider.refresh(node);
    },
  );

  const openChapterCommand = vscode.commands.registerCommand(
    "gtbook_explorer.openChapter",
    (node: ChapterNode) => {
      if (!node) {
        return;
      }
      const uri = vscode.Uri.file(
        `${node.gtbook.folderPath}/chapters/${node.chapter.id}.md`,
      );
      vscode.window.showTextDocument(uri, {
        preview: true,
        preserveFocus: true,
      });
    },
  );

  const renameChapterCommand = vscode.commands.registerCommand(
    "gtbook_explorer.renameChapter",
    async (node: ChapterNode) => {
      const title = await vscode.window.showInputBox({
        title: "Rename Chapter",
        value: node.chapter.title,
        prompt: "Enter the new title of the chapter",
        validateInput: (v) =>
          v.trim() ? null : "Chapter title cannot be empty",
      });

      if (!title) {
        return;
      }

      const gtbook = gtbookApp.getBook(node.gtbook.folderPath);
      if (!gtbook) {
        return;
      }

      gtbook.renameChapter(node.chapter.id, title);
      gtbookProvider.refresh();
    },
  );

  const moveUpCommand = vscode.commands.registerCommand(
    "gtbook_explorer.moveUp",
    (node: ChapterNode) => {
      const gtbook = gtbookApp.getBook(node.gtbook.folderPath);
      if (!gtbook) {
        return;
      }
      gtbook.moveUp(node.chapter);
      gtbookProvider.refresh(node);
    },
  );
  const moveDownCommand = vscode.commands.registerCommand(
    "gtbook_explorer.moveDown",
    (node: ChapterNode) => {
      const gtbook = gtbookApp.getBook(node.gtbook.folderPath);
      if (!gtbook) {
        return;
      }
      gtbook.moveDown(node.chapter);
      gtbookProvider.refresh(node);
    },
  );

  const newBookCommand = vscode.commands.registerCommand(
    "gtbook_explorer.newBook",
    async () => {
      try {
        let bookTitle = await vscode.window.showInputBox({
          prompt: "Book Title",
          validateInput: (v) => (v ? null : "Book title is required"),
        });
        if (!bookTitle) {
          return;
        }

        bookTitle = bookTitle.trim();

        if (!bookTitle) {
          return "Book title cannot be empty";
        }

        if (bookTitle === "." || bookTitle === "..") {
          return "Book title cannot be '.' or '..'";
        }

        if (INVALID_CHARS_REGEX.test(bookTitle)) {
          return 'Book title cannot contain the following characters: / \\ : * ? " < > |';
        }

        const folders = await vscode.window.showOpenDialog({
          canSelectFolders: true,
          canSelectFiles: false,
          canSelectMany: false,
          openLabel: "Create book here",
        });
        if (!folders || folders.length === 0) {
          return;
        }

        const parentDir = folders[0].fsPath;
        const bookDir = path.join(parentDir, bookTitle);

        if (await exists(bookDir)) {
          vscode.window.showErrorMessage(
            `Folder "${bookTitle}" already exists.`,
          );
          return;
        }

        await fsp.mkdir(bookDir, { recursive: true });
        const gtbookPath = path.join(bookDir, metaFile);
        await fsp.writeFile(gtbookPath, defaultGtbookYaml(bookTitle), "utf8");

        vscode.workspace.updateWorkspaceFolders(
          vscode.workspace.workspaceFolders?.length ?? 0,
          0,
          { uri: vscode.Uri.file(bookDir), name: bookTitle },
        );

        vscode.window.showInformationMessage(`GTBook "${bookTitle}" created.`);
      } catch (err: any) {
        vscode.window.showErrorMessage(
          `Failed to create book: ${err.message ?? err}`,
        );
      }
      gtbookProvider.refresh();
    },
  );

  context.subscriptions.push(refreshCommand);
  context.subscriptions.push(newChapterCommand);
  context.subscriptions.push(deleteChapterCommand);
  context.subscriptions.push(openChapterCommand);
  context.subscriptions.push(renameChapterCommand);
  context.subscriptions.push(moveUpCommand);
  context.subscriptions.push(moveDownCommand);
  context.subscriptions.push(newBookCommand);
};
