import * as vscode from "vscode";
import * as fs from "fs";
import * as fsp from "fs/promises";
import * as path from "path";
import * as yaml from "yaml";
import { randomUUID } from "node:crypto";

import { Chapter, GTBookMeta } from "./types";
import { assert } from "console";

export const metaFile = "gtbook.yaml";

export class GTBookService {
  private _gtbookMeta?: GTBookMeta;

  private id2Pid: Map<string, string | null> = new Map();
  private id2Chapter: Map<string, Chapter> = new Map();

  constructor(private gtbookMetaPath: string) {}

  get gtbookMeta(): GTBookMeta {
    if (!this._gtbookMeta) {
      this.loadFromMetaFile();
    }

    assert(this._gtbookMeta, "加载gtbook.yaml失败");
    return this._gtbookMeta!;
  }

  loadFromMetaFile() {
    const gtbookMeta = yaml.parse(
      fs.readFileSync(this.gtbookMetaPath, "utf-8"),
    );

    this._gtbookMeta = gtbookMeta;

    if (!gtbookMeta.chapters) {
      gtbookMeta.chapters = [];
    }

    gtbookMeta.chapters.forEach((chapterInfo: any) => {
      this._buildChapterItem(chapterInfo);
    });

    return this._gtbookMeta;
  }

  saveToMetaFile() {
    this._gtbookMeta!.updatedTime = Date.now();
    fs.writeFileSync(
      this.gtbookMetaPath,
      yaml.stringify(this._gtbookMeta),
      "utf-8",
    );
  }

  getTree(): Chapter[] {
    return this.gtbookMeta.chapters || [];
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
    const id = randomUUID();
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
      this.gtbookMeta.chapters.push(newChapter);
    }
    this.id2Chapter.set(newChapter.id, newChapter);

    const fileName = `${id}.md`;
    const filePath = path.join(bookDir, "chapters", fileName);

    await fsp.mkdir(path.dirname(filePath), { recursive: true });

    const content = `\n`;
    await fsp.writeFile(filePath, content, "utf-8");

    this.saveToMetaFile();
  }

  deleteChapter(chapter: Chapter) {
    this.id2Chapter.delete(chapter.id);
    let parent = this.getParent(chapter);

    if (parent) {
      this._removeChapterFromList(parent.chapters, chapter);
    } else {
      this._removeChapterFromList(this.gtbookMeta.chapters, chapter);
    }

    this.id2Pid.delete(chapter.id);

    if (chapter.chapters) {
      chapter.chapters.forEach((subChapter) => {
        this.deleteChapter(subChapter);
      });
    }

    this.saveToMetaFile();
  }

  renameChapter(chapterId: string, newTitle: string) {
    const chapter = this.id2Chapter.get(chapterId);
    if (!chapter) {
      return;
    }
    chapter.title = newTitle;
    this.saveToMetaFile();
  }

  moveChapters(target: Chapter | undefined, sources: Chapter[]) {
    if (!sources) {
      return;
    }
    let toMoveChapters = this._getLocalRoots(sources);

    if (!target) {
      // 把所有章节都移动到根目录
      const rootIdSet = new Set();
      this._gtbookMeta!.chapters.forEach((r) => rootIdSet.add(r.id));
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

  moveUp(chapter: Chapter) {
    const parent = this.getParent(chapter);
    const chapters = parent ? parent.chapters : this.gtbookMeta.chapters;

    const index = chapters.findIndex((c) => c.id === chapter.id);
    if (index <= 0) {
      return;
    }
    const prevChapter = chapters[index - 1];
    chapters[index - 1] = chapter;
    chapters[index] = prevChapter;
    this.saveToMetaFile();
  }

  moveDown(chapter: Chapter) {
    const parent = this.getParent(chapter);
    const chapters = parent ? parent.chapters : this.gtbookMeta.chapters;

    const index = chapters.findIndex((c) => c.id === chapter.id);
    if (index < 0 || index >= chapters.length - 1) {
      return;
    }
    const nextChapter = chapters[index + 1];
    chapters[index + 1] = chapter;
    chapters[index] = nextChapter;
    this.saveToMetaFile();
  }

  moveChaptersToRoot(toMoveChapters: Chapter[]) {
    const rootIdSet = new Set();
    this._gtbookMeta!.chapters.forEach((r) => rootIdSet.add(r.id));
    toMoveChapters = toMoveChapters.filter((r) => !rootIdSet.has(r.id));
    this._gtbookMeta!.chapters.push(...toMoveChapters);
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
  _reparentNode(node: Chapter, target: Chapter | undefined): void {
    // 从老位置，移除节点
    const parent = this.getParent(node);
    const chapters = parent ? parent.chapters : this.gtbookMeta.chapters;
    this._removeChapterFromList(chapters, node);

    // 在新位置插入节点
    if (target) {
      target.chapters.push(node);
    } else {
      this.gtbookMeta.chapters.push(node);
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
