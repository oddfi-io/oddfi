// 球员名解析 — mock / SportMonks 数据格式约定 "Surname, FirstName"
// ASSETS.md 已查（关键词：player / name / format），无替代品

export interface PlayerNameParts {
  last: string;
  first: string;
}

export function splitPlayerName(name: string): PlayerNameParts {
  const [rawLast, rawFirst] = name.split(",");
  return {
    last: rawLast?.trim() ?? name,
    first: rawFirst?.trim() ?? "",
  };
}

export function getPlayerLastName(name: string): string {
  return splitPlayerName(name).last;
}
