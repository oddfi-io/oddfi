/**
 * DD-120：`short_code` → 英文匹配别名（WC 732 + 欧冠 2 全部球队）。
 *
 * 为什么需要：dev/testnet 后端（dev-market-api）**不返回英文 title**，无论传 `app_lang=en` 与否，
 * `participant.name` 恒中文（「阿森纳」「阿根廷」）。而新闻 `originalText` 恒英文，无法用中文名匹配。
 * `short_code`（ARS / PSG / ARG…）是 **locale 稳定键**（dev/prod 一致），故用它桥接到英文别名。
 *
 * 别名是**归一化形态**（小写 + 去重音 + 单空格），匹配时按词边界整词比对，故：
 *   - 多词队名同时收常见简称（USA / 韩国 South Korea / PSG / Barcelona / DR Congo）；
 *   - **不收会与普通英文词撞车的裸词**（如 "Sporting CP" 不收 "sporting"）。
 *
 * 球队列表由 prod market-api 英文数据生成；简称/裸词风险为人工审定。改名/扩联赛时维护此表。
 */
export const TEAM_ALIASES_BY_SHORT_CODE: Record<string, string[]> = {
  ARG: ["argentina"],
  ARS: ["arsenal"],
  AUS: ["australia"],
  AUT: ["austria"],
  BAR: ["barcelona", "fc barcelona"],
  BEL: ["belgium"],
  BIH: ["bosnia and herzegovina", "bosnia"],
  BRA: ["brazil"],
  CAN: ["canada"],
  COD: ["congo dr", "dr congo"],
  COL: ["colombia"],
  CPV: ["cape verde islands", "cape verde"],
  CRO: ["croatia"],
  CUW: ["curacao"],
  CZE: ["czech republic", "czechia"],
  DZA: ["algeria"],
  ECU: ["ecuador"],
  EGY: ["egypt"],
  ENG: ["england"],
  ESP: ["spain"],
  FRA: ["france"],
  GER: ["germany"],
  GHA: ["ghana"],
  HTI: ["haiti"],
  IRN: ["iran"],
  IRQ: ["iraq"],
  JOR: ["jordan"],
  JPN: ["japan"],
  KOR: ["south korea", "korea republic"],
  KSA: ["saudi arabia"],
  LIV: ["liverpool"],
  MAR: ["morocco"],
  MEX: ["mexico"],
  NED: ["netherlands"],
  NOR: ["norway"],
  NZL: ["new zealand"],
  PAN: ["panama"],
  POR: ["portugal"],
  PRY: ["paraguay"],
  PSG: ["paris saint germain", "psg"],
  QAT: ["qatar"],
  RMA: ["real madrid"],
  SCO: ["scotland"],
  SCP: ["sporting cp", "sporting lisbon"],
  SEN: ["senegal"],
  SUI: ["switzerland"],
  SWE: ["sweden"],
  TUN: ["tunisia"],
  TUR: ["turkey"],
  URU: ["uruguay"],
  USA: ["united states", "usa"],
  UZB: ["uzbekistan"],
  ZAF: ["south africa"],
};
