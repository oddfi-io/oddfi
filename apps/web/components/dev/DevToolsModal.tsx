"use client";

import { useState, useEffect } from "react";
import { useDevToolsStore } from "@/stores/devToolsStore";
import Modal from "@/components/ui/Modal";
import { useTxStatus } from "@/hooks/useTxStatus";
import { showToast } from "@/lib/toast";
import { IS_TESTNET } from "@/lib/network-mode";
import { IS_EARLY_BIRD_MODE } from "@/lib/early-bird-mode";
import { useEarlyBird } from "@/components/early-bird/EarlyBirdProvider";
import { SignalLightSimFloating } from "@/components/dev/SignalLightSimFloating";

function bscScanTxUrl(txHash: string): string {
  const base = IS_TESTNET ? "https://testnet.bscscan.com" : "https://bscscan.com";
  return `${base}/tx/${txHash}`;
}

function isValidTxHash(s: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(s);
}

export function DevToolsModal() {
  const isOpen = useDevToolsStore((s) => s.isModalOpen);
  const closeModal = useDevToolsStore((s) => s.closeModal);
  const signalSimActive = useDevToolsStore((s) => s.signalSimActive);
  const setSignalSimActive = useDevToolsStore((s) => s.setSignalSimActive);

  // ── DD-103 续: Early Bird invite-code bypass ─────────────────────
  const [inviteInput, setInviteInput] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  // 早鸟模式启用且 Provider 已被 SSR 注入 bypass → isActive=false 即 bypass 生效
  const { isActive: earlyBirdActive } = useEarlyBird();
  const bypassActive = IS_EARLY_BIRD_MODE && !earlyBirdActive;

  // ── DD-101 dev: subscribe arbitrary tx_hash to WS service ──────
  const [txHashInput, setTxHashInput] = useState("");
  const [submittedHash, setSubmittedHash] = useState<string | undefined>();
  const [txHashError, setTxHashError] = useState("");
  const txStatus = useTxStatus(submittedHash);

  // Reset input errors when modal opens
  useEffect(() => {
    if (isOpen) {
      setTxHashError("");
      setInviteError("");
    }
  }, [isOpen]);

  const handleVerifyInvite = async () => {
    const trimmed = inviteInput.trim();
    if (!trimmed) {
      setInviteError("请输入邀请码");
      return;
    }
    setInviteError("");
    setInviteSubmitting(true);
    try {
      const res = await fetch("/api/auth/early-bird-bypass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setInviteError(body.error || `验证失败（${res.status}）`);
        setInviteSubmitting(false);
        return;
      }
      showToast("邀请码已验证 —— 正在刷新…", "success");
      // 关闭 modal 后整页 reload，让 middleware + Provider 在新一轮请求中重新评估 bypass
      closeModal();
      setTimeout(() => window.location.reload(), 300);
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : "网络异常");
      setInviteSubmitting(false);
    }
  };

  // React to WS terminal status — pop toast + close modal on success
  useEffect(() => {
    if (!submittedHash) return;
    if (txStatus.state === "settled") {
      const url = bscScanTxUrl(submittedHash);
      const shortHash = `${submittedHash.slice(0, 10)}…${submittedHash.slice(-6)}`;
      if (txStatus.result.status === "success") {
        showToast(`交易已确认 —— ${shortHash}`, "success", {
          description: `区块 #${txStatus.result.block_number}`,
          actionLabel: "在 BscScan 查看",
          onAction: () => window.open(url, "_blank", "noopener"),
          duration: 10_000,
        });
        closeModal();
      } else if (txStatus.result.status === "failed") {
        showToast(`交易失败 —— ${shortHash}`, "error", {
          actionLabel: "在 BscScan 查看",
          onAction: () => window.open(url, "_blank", "noopener"),
        });
      } else {
        // timeout
        showToast(`交易订阅超时（2 分钟内未上链）—— ${shortHash}`, "warning", {
          actionLabel: "在 BscScan 查看",
          onAction: () => window.open(url, "_blank", "noopener"),
        });
      }
      setSubmittedHash(undefined);
      setTxHashInput("");
    } else if (txStatus.state === "error") {
      setTxHashError(txStatus.error.message);
      setSubmittedHash(undefined);
    }
  }, [txStatus, submittedHash, closeModal]);

  const handleSubscribe = () => {
    const trimmed = txHashInput.trim();
    if (!isValidTxHash(trimmed)) {
      setTxHashError("tx hash 非法（必须是 0x + 64 位十六进制）");
      return;
    }
    setTxHashError("");
    setSubmittedHash(trimmed);
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={closeModal} title="开发者工具">
        <div className="space-y-5 pb-2">
          {/* Early Bird Invite Bypass (DD-103 续) */}
          <div>
            <label className="block text-xs text-secondary mb-1.5">早鸟邀请码绕过</label>
            <p className="text-[11px] text-tertiary mb-2">
              输入邀请码（= 服务端 INVITE_CODE）。验证通过后整页刷新、早鸟闸门解除（落地页重定向 /
              早鸟弹窗 / 钱包连接恢复正常流程）。
            </p>
            {bypassActive ? (
              <p className="text-[11px] text-fn-green font-mono">
                bypass：已生效 —— 本浏览器已验证过
              </p>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inviteInput}
                    onChange={(e) => {
                      setInviteInput(e.target.value);
                      setInviteError("");
                    }}
                    placeholder="邀请码"
                    spellCheck={false}
                    autoComplete="off"
                    disabled={inviteSubmitting}
                    className="flex-1 min-w-0 h-11 px-3 rounded-12 bg-fill-input border border-divider text-sm text-primary placeholder:text-tertiary outline-none focus:border-fn-brand transition-colors font-mono disabled:opacity-50"
                  />
                  <button
                    onClick={handleVerifyInvite}
                    disabled={inviteSubmitting || !inviteInput.trim()}
                    className="shrink-0 h-11 px-4 rounded-12 bg-fn-brand font-semibold text-sm text-static-black hover:bg-fn-brand/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ touchAction: "manipulation" }}
                  >
                    {inviteSubmitting ? "验证中…" : "验证"}
                  </button>
                </div>
                {inviteError && <p className="text-xs text-fn-red mt-1">{inviteError}</p>}
              </>
            )}
          </div>

          {/* Tx Hash WS Subscribe (DD-101) */}
          <div>
            <label className="block text-xs text-secondary mb-1.5">Tx Hash WS 订阅</label>
            <p className="text-[11px] text-tertiary mb-2">
              通过 WS 订阅交易终态。用最近 1 分钟内确认的 hash 可命中缓存即时返回。
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={txHashInput}
                onChange={(e) => {
                  setTxHashInput(e.target.value);
                  setTxHashError("");
                }}
                placeholder="0x..."
                spellCheck={false}
                disabled={txStatus.state === "subscribing"}
                className="flex-1 min-w-0 h-11 px-3 rounded-12 bg-fill-input border border-divider text-sm text-primary placeholder:text-tertiary outline-none focus:border-fn-brand transition-colors font-mono disabled:opacity-50"
              />
              <button
                onClick={handleSubscribe}
                disabled={txStatus.state === "subscribing" || !txHashInput.trim()}
                className="shrink-0 h-11 px-4 rounded-12 bg-fn-brand font-semibold text-sm text-static-black hover:bg-fn-brand/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ touchAction: "manipulation" }}
              >
                {txStatus.state === "subscribing" ? "订阅中…" : "订阅"}
              </button>
            </div>
            {txHashError && <p className="text-xs text-fn-red mt-1">{txHashError}</p>}
            {txStatus.state === "subscribing" && (
              <p className="text-[11px] text-tertiary mt-2 font-mono">
                状态：订阅中 · 等待 ws 推送…
              </p>
            )}
          </div>

          {/* Onchain Signal Light Simulator (DD-119) — 激活独立可拖拽浮窗 */}
          <div>
            <label className="block text-xs text-secondary mb-1.5">链上信号灯模拟器</label>
            <p className="text-[11px] text-tertiary mb-2">
              激活可拖拽浮窗，注入 mock 的 <span className="font-mono">odds_updated</span>{" "}
              推送（signal 3 → 红灯锁定 <span className="font-mono">--</span>，±8%
              涨绿/跌红闪烁），同时观察页面赔率格实时刷新。先打开带链上赔率的赛事列表 /
              详情页以建立订阅。
            </p>
            <button
              onClick={() => setSignalSimActive(!signalSimActive)}
              className={`w-full h-11 rounded-12 text-sm font-semibold transition-colors ${
                signalSimActive
                  ? "bg-fn-red/15 border border-fn-red text-fn-red hover:bg-fn-red/25"
                  : "bg-fn-brand text-static-black hover:bg-fn-brand/90"
              }`}
              style={{ touchAction: "manipulation" }}
            >
              {signalSimActive ? "关闭浮窗模拟器" : "激活浮窗模拟器"}
            </button>
          </div>
        </div>
      </Modal>
      {signalSimActive && <SignalLightSimFloating />}
    </>
  );
}
