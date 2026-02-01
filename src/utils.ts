import * as fsp from "fs/promises";

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
