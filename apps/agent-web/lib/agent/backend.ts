import type { DockPush } from "./dockMockData";

const BACKEND_BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8080";

export interface ChatBackendMessage {
  role: "user" | "assistant";
  content: string;
}

export async function listPush(limit = 20): Promise<DockPush[]> {
  const r = await fetch(`${BACKEND_BASE}/api/push?limit=${limit}`, {
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`listPush ${r.status}`);
  const j = await r.json();
  return Array.isArray(j.items) ? j.items : [];
}

export async function chat(messages: ChatBackendMessage[]): Promise<string> {
  const r = await fetch(`${BACKEND_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`chat ${r.status}: ${body}`);
  }
  const j = await r.json();
  return j.reply ?? "";
}

export interface AnalysisOutcome {
  home: number;
  draw: number;
  away: number;
}

export interface AnalysisData {
  match: string;
  startTime: string;
  hoursToStart: number;
  aiProb: AnalysisOutcome;
  marketProb: AnalysisOutcome;
  evidence: string[];
  unknown: string;
  suggestionRange: string;
  pickLabel: string;
  pickOdds: number;
  summary: string;
  updatedAt: number;
  basedOnTweets: number;
}

export interface AnalysisResponse {
  ready: boolean;
  reason?: string;
  analysis?: AnalysisData;
}

export async function getAnalysis(): Promise<AnalysisResponse> {
  const r = await fetch(`${BACKEND_BASE}/api/analysis`, {
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`getAnalysis ${r.status}`);
  return r.json();
}
