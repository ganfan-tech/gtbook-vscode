import * as fsp from "fs/promises";
import * as vscode from "vscode";

import { API } from "./types.git";

export async function exists(p: string): Promise<boolean> {
  try {
    await fsp.stat(p);
    return true;
  } catch {
    return false;
  }
}

export function defaultGtbookYaml(title: string): string {
  return `# GTBook config
title: ${title}
createdTime: ${Date.now()}
updatedTime: ${Date.now()}
chapters: []
`;
}

function _git(): API {
  const gitExtension = vscode.extensions.getExtension("vscode.git");
  const git: API = gitExtension?.exports.getAPI(1);
  return git;
}

export const git = _git();