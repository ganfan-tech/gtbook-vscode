import * as fsp from "fs/promises";
import * as path from "path";
import * as yaml from "yaml";
import * as vscode from "vscode";
import { randomBytes } from "node:crypto";
import { Repository } from "./types.git";

import { Chapter, GTBookMeta } from "./types";
import { metaFile } from "./constants";
import { git } from "./utils";

export class GTBook {
  private _meta?: GTBookMeta;

  private _repo?: Repository;

  private id2Pid: Map<string, string | null> = new Map();
  private id2Chapter: Map<string, Chapter> = new Map();

  constructor(
    public folderPath: string,
    private gtbookMetaPath: string,
    private gtbookEventEmitter: vscode.EventEmitter<GTBook | undefined>,
    gtbookMetaContent: string,
  ) {
    this.gtbookMetaPath = path.join(this.folderPath, metaFile);

    this._meta = yaml.parse(gtbookMetaContent);

    if (!this._meta) {
      throw new Error("gtbook meta file is empty");
    }

    if (!this._meta.chapters) {
      this._meta.chapters = [];
    }

    this._meta.chapters.forEach((chapterInfo: any) => {
      this._buildChapterItem(chapterInfo);
    });

    this._subscribeGit();
  }

  get meta(): GTBookMeta {
    return this._meta!;
  }

  get repo(): Repository | undefined {
    return this._repo;
  }
  set repo(repo: Repository | undefined) {
    this._repo = repo;
  }

  async saveToMetaFile() {
    this._meta!.updatedTime = Date.now();
    await fsp.writeFile(
      this.gtbookMetaPath,
      yaml.stringify(this._meta),
      "utf-8",
    );
  }

  _subscribeGit() {
    git.onDidChangeState(() => {
      this._loadRepo();
    });
  }

  _loadRepo() {
    const repo = git.repositories.find(
      (repo) => repo.rootUri.path === this.folderPath,
    );

    this._repo = repo;

    this._repo?.state.onDidChange(() => {
      this.gtbookEventEmitter.fire(this);
    });

    return this._repo;
  }

  gitStatus(): string {
    const repo = this._repo;

    if (!repo) {
      return "";
    }

    const messages = [];
    const changed =
      repo.state.workingTreeChanges.length + repo.state.indexChanges.length;

    if (changed > 0) {
      messages.push(`${changed} files changed`);
    }
    const unpushed = repo.state.HEAD?.ahead ?? 0;
    if (unpushed > 0) {
      messages.push(`${unpushed} unpushed commit${unpushed === 1 ? "" : "s"}`);
    }
    return messages.join(", ");
  }

  getTree(): Chapter[] {
    return this.meta.chapters || [];
  }

  private _buildChapterItem(
    chapterInfo: Chapter,
    parentId: string | null = null,
  ): Chapter {
    const subChapters = [];
    if (!chapterInfo.chapters) {
      chapterInfo.chapters = [];
    }
    const subChapterInfos = chapterInfo.chapters;

    for (let subChapterInfo of subChapterInfos) {
      const subChapter = this._buildChapterItem(subChapterInfo, chapterInfo.id);
      subChapters.push(subChapter);
    }

    const chapter = chapterInfo;

    const ifHasKey = this.id2Pid.has(chapter.id);
    if (ifHasKey) {
      console.log(`chapterId is repeated ${chapter.id}`);
    }
    this.id2Pid.set(chapter.id, parentId);
    this.id2Chapter.set(chapter.id, chapter);

    return chapter;
  }

  async newChapter(chapter: Chapter | undefined, newTitle: string) {
    const bookDir = path.dirname(this.gtbookMetaPath);
    const id = `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
    const newChapter = {
      id: id,
      title: newTitle,
      createdTime: Date.now(),
      updatedTime: Date.now(),
      chapters: [],
    };
    if (chapter) {
      chapter.chapters.push(newChapter);
      this.id2Pid.set(newChapter.id, chapter.id);
    } else {
      this.meta.chapters.push(newChapter);
    }
    this.id2Chapter.set(newChapter.id, newChapter);

    const fileName = `${id}.md`;
    const filePath = path.join(bookDir, "chapters", fileName);

    await fsp.mkdir(path.dirname(filePath), { recursive: true });

    const content = `# ${newTitle}`;
    await fsp.writeFile(filePath, content, "utf-8");

    await this.saveToMetaFile();
    return newChapter;
  }

  async deleteChapter(chapter: Chapter) {
    this.id2Chapter.delete(chapter.id);
    let parent = this.getParent(chapter);

    if (parent) {
      this._removeChapterFromList(parent.chapters, chapter);
    } else {
      this._removeChapterFromList(this.meta.chapters, chapter);
    }

    this.id2Pid.delete(chapter.id);

    if (chapter.chapters) {
      chapter.chapters.forEach((subChapter) => {
        this.deleteChapter(subChapter);
      });
    }

    this.saveToMetaFile();
  }

  async renameChapter(chapterId: string, newTitle: string) {
    const chapter = this.id2Chapter.get(chapterId);
    if (!chapter) {
      return;
    }
    chapter.title = newTitle;
    this.saveToMetaFile();
  }

  async moveChapters(target: Chapter | undefined, chapterIds: string[]) {
    if (!chapterIds) {
      return;
    }

    const chapters = chapterIds.map((id) => this.id2Chapter.get(id)!);
    let toMoveChapters = this._getLocalRoots(chapters);

    if (!target) {
      // 把所有章节都移动到根目录
      const rootIdSet = new Set();
      this._meta!.chapters.forEach((r) => rootIdSet.add(r.id));
      toMoveChapters = toMoveChapters.filter((r) => !rootIdSet.has(r.id));
      toMoveChapters.forEach((r) => this._reparentNode(r, target));
    } else {
      // Remove nodes that are in the target
      toMoveChapters = toMoveChapters.filter((r) => !this._isParent(target, r));
      // Remove nodes that are already target's parent nodes
      toMoveChapters = toMoveChapters.filter(
        (r) => !this._isDescendant(r, target),
      );

      toMoveChapters.forEach((r) => this._reparentNode(r, target));
    }

    this.saveToMetaFile();
  }

  async moveUp(chapter: Chapter) {
    const parent = this.getParent(chapter);
    const chapters = parent ? parent.chapters : this.meta.chapters;

    const index = chapters.findIndex((c) => c.id === chapter.id);
    if (index <= 0) {
      return;
    }
    const prevChapter = chapters[index - 1];
    chapters[index - 1] = chapter;
    chapters[index] = prevChapter;
    this.saveToMetaFile();
  }

  async moveDown(chapter: Chapter) {
    const parent = this.getParent(chapter);
    const chapters = parent ? parent.chapters : this.meta.chapters;

    const index = chapters.findIndex((c) => c.id === chapter.id);
    if (index < 0 || index >= chapters.length - 1) {
      return;
    }
    const nextChapter = chapters[index + 1];
    chapters[index + 1] = chapter;
    chapters[index] = nextChapter;
    this.saveToMetaFile();
  }

  _getLocalRoots(nodes: Chapter[]): Chapter[] {
    const localRoots = [];
    for (const node of nodes) {
      const parent = this.getParent(node);
      if (parent) {
        const isInList = nodes.find((n) => n.id === parent.id);
        if (isInList === undefined) {
          localRoots.push(node);
        }
      } else {
        localRoots.push(node);
      }
    }
    return localRoots;
  }

  public getParent(element: Chapter): Chapter | undefined {
    const pid = this.id2Pid.get(element.id);
    if (!pid) {
      return undefined;
    }
    return this.id2Chapter.get(pid);
  }

  // Remove node from current position and add node to new target element
  async _reparentNode(
    node: Chapter,
    target: Chapter | undefined,
  ): Promise<void> {
    // 从老位置，移除节点
    const parent = this.getParent(node);
    const chapters = parent ? parent.chapters : this.meta.chapters;
    this._removeChapterFromList(chapters, node);

    // 在新位置插入节点
    if (target) {
      target.chapters.push(node);
    } else {
      this.meta.chapters.push(node);
    }

    this.id2Pid.set(node.id, target ? target.id : null);
  }

  _removeChapterFromList(chapters: Chapter[], target: Chapter) {
    const targetIndex = chapters.findIndex((c) => c.id === target.id);
    if (targetIndex < 0) {
      return false;
    }
    chapters.splice(targetIndex, 1);
    return true;
  }

  // 判断某个 child 是不是 ancestry 的孩子
  // 是他本身也算
  _isDescendant(ancestry: Chapter, child: Chapter): boolean {
    // 是他本身也算
    if (ancestry.id === child.id) {
      return true;
    }

    const childsParentId = this.id2Pid.get(child.id);
    if (!childsParentId) {
      return false;
    }

    const childsParent = this.id2Chapter.get(childsParentId);
    if (!childsParent) {
      return false;
    }

    if (childsParentId === ancestry.id) {
      return true;
    } else {
      // 判断 child 的父亲是不是 ancestry 的孩子
      return this._isDescendant(ancestry, childsParent);
    }
  }
  _isParent(parent: Chapter, child: Chapter) {
    const childsParentId = this.id2Pid.get(child.id);
    if (!childsParentId) {
      return false;
    } else {
      return childsParentId === parent.id;
    }
  }
}
