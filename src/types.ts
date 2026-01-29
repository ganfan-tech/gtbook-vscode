export interface Chapter {
  id: string;
  title: string;
  createdTime: number;
  updatedTime: number;
  chapters: Chapter[];
}

export interface GTBookMeta {
  name: string;
  createdTime: number;
  updatedTime: number;
  chapters: Chapter[];
}
