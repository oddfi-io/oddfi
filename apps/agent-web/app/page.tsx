import { AgentSettings } from "@/components/agent/AgentSettings";
import { AgentDock } from "@/components/agent/dock/AgentDock";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-edge px-6 py-4">
        <div className="max-w-4xl mx-auto w-full">
          <h1 className="text-base font-semibold">OddFi AI Agent · Settings</h1>
          <p className="text-xs text-ink-3 mt-1">
            设置页 v0.1（5 Tab 全部可用）· 右下角浮窗 = 对话坞（参考 calendar-prototype 风格）
          </p>
        </div>
      </header>
      <AgentSettings />
      <AgentDock />
    </main>
  );
}
