export type PersonaId = "rational" | "companion" | "aggressive" | "strict";

export interface Persona {
  id: PersonaId;
  emoji: string;
  name: string;
  description: string;
  defaultRiskPreference: number;
}

export const PERSONAS: Persona[] = [
  {
    id: "rational",
    emoji: "🧊",
    name: "理性",
    description: "数据说话，不追热门。估算价值不显著（< 3pp）时不推。",
    defaultRiskPreference: 3,
  },
  {
    id: "companion",
    emoji: "🌿",
    name: "陪伴",
    description: "重聊天轻推荐。会问你今天怎么样，会复盘上一场你的判断。",
    defaultRiskPreference: 4,
  },
  {
    id: "aggressive",
    emoji: "🔥",
    name: "进取",
    description: "见到价值就推，语气热血。守住基准 3x 硬底线。",
    defaultRiskPreference: 7,
  },
  {
    id: "strict",
    emoji: "🛡️",
    name: "严格",
    description: "推荐前先问状态。最近输得多就主动拒绝推荐。",
    defaultRiskPreference: 2,
  },
];

export const DEFAULT_PERSONA: PersonaId = "companion";

export function getPersona(id: PersonaId): Persona {
  const found = PERSONAS.find((p) => p.id === id);
  if (!found) throw new Error(`Unknown persona: ${id}`);
  return found;
}
