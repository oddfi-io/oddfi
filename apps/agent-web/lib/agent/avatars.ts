export interface Avatar {
  id: string;
  number: number;
  nameEn: string;
  nameZh: string;
  emoji: string;
}

export const AVATARS: Avatar[] = [
  { id: "No.01", number: 1, nameEn: "Cat", nameZh: "猫", emoji: "🐱" },
  { id: "No.02", number: 2, nameEn: "Koala", nameZh: "考拉", emoji: "🐨" },
  { id: "No.03", number: 3, nameEn: "Fox", nameZh: "狐", emoji: "🦊" },
  { id: "No.04", number: 4, nameEn: "Panda", nameZh: "熊猫", emoji: "🐼" },
  { id: "No.05", number: 5, nameEn: "Tiger", nameZh: "虎", emoji: "🐯" },
  { id: "No.06", number: 6, nameEn: "Wolf", nameZh: "狼", emoji: "🐺" },
  { id: "No.07", number: 7, nameEn: "Lion", nameZh: "狮", emoji: "🦁" },
  { id: "No.08", number: 8, nameEn: "Bear", nameZh: "熊", emoji: "🐻" },
  { id: "No.09", number: 9, nameEn: "Rabbit", nameZh: "兔", emoji: "🐰" },
  { id: "No.10", number: 10, nameEn: "Mouse", nameZh: "鼠", emoji: "🐭" },
  { id: "No.11", number: 11, nameEn: "Hamster", nameZh: "仓鼠", emoji: "🐹" },
  { id: "No.12", number: 12, nameEn: "Frog", nameZh: "蛙", emoji: "🐸" },
  { id: "No.13", number: 13, nameEn: "Monkey", nameZh: "猴", emoji: "🐵" },
  { id: "No.14", number: 14, nameEn: "Eagle", nameZh: "鹰", emoji: "🦅" },
  { id: "No.15", number: 15, nameEn: "Owl", nameZh: "猫头鹰", emoji: "🦉" },
  { id: "No.16", number: 16, nameEn: "Penguin", nameZh: "企鹅", emoji: "🐧" },
  { id: "No.17", number: 17, nameEn: "Whale", nameZh: "鲸", emoji: "🐳" },
  { id: "No.18", number: 18, nameEn: "Dolphin", nameZh: "海豚", emoji: "🐬" },
  { id: "No.19", number: 19, nameEn: "Shark", nameZh: "鲨", emoji: "🦈" },
  { id: "No.20", number: 20, nameEn: "Octopus", nameZh: "章鱼", emoji: "🐙" },
  { id: "No.21", number: 21, nameEn: "Crab", nameZh: "蟹", emoji: "🦀" },
  { id: "No.22", number: 22, nameEn: "Dragon", nameZh: "龙", emoji: "🐲" },
  { id: "No.23", number: 23, nameEn: "Unicorn", nameZh: "独角兽", emoji: "🦄" },
  { id: "No.24", number: 24, nameEn: "Bee", nameZh: "蜂", emoji: "🐝" },
  { id: "No.25", number: 25, nameEn: "Butterfly", nameZh: "蝶", emoji: "🦋" },
  { id: "No.26", number: 26, nameEn: "Snail", nameZh: "蜗牛", emoji: "🐌" },
  { id: "No.27", number: 27, nameEn: "Fish", nameZh: "鱼", emoji: "🐠" },
  { id: "No.28", number: 28, nameEn: "Turtle", nameZh: "龟", emoji: "🐢" },
  { id: "No.29", number: 29, nameEn: "Hedgehog", nameZh: "刺猬", emoji: "🦔" },
  { id: "No.30", number: 30, nameEn: "Cow", nameZh: "牛", emoji: "🐄" },
];

export const DEFAULT_AVATAR_ID = "No.01";

export function getAvatar(id: string): Avatar {
  const found = AVATARS.find((a) => a.id === id);
  if (!found) throw new Error(`Unknown avatar: ${id}`);
  return found;
}
