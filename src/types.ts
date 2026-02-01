export interface Chapter {
  id: string;
  title: string;
  createdTime: number;
  updatedTime: number;
  chapters: Chapter[];
}

export interface GTBookMeta {
  title: string;
  createdTime: number;
  updatedTime: number;
  chapters: Chapter[];
}
