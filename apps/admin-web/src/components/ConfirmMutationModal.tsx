/**
 * ConfirmMutationModal — reusable destructive-action confirmation modal.
 *
 * Contract: docs/spa-presale-admin/04-components.md §1.
 * Design tokens: all colours / radii / weights via AntD ConfigProvider (vercelTheme.ts).
 *
 * ## destroyOnHidden / re-use note
 * `destroyOnHidden={false}` is intentional (better perf: DOM is kept, not torn down on close).
 * Consequence: when the modal transitions from closed → open, `form.resetFields()` runs via the
 * `open` effect, clearing any leftover note text. However, if the *caller* changes `noteMinLength`
 * or `extraFields` while the modal is closed, the component does NOT re-validate already-reset
 * fields — that is the caller's responsibility. If you need strict per-open isolation, pass a
 * `key` prop to force remount instead of relying on this re-use path.
 *
 * @see ConfirmMutationModal.test.tsx for full lifecycle coverage.
 */
import { useEffect, useState } from "react";
import { Alert, Descriptions, Form, Input, Modal, theme } from "antd";
import type React from "react";
import { ApiError } from "@/types/api";
import { useIdempotencyKey } from "@/hooks/useIdempotencyKey";

// ── Error mapping table (02-data-layer.md §4, full presale + admin-users + idempotency codes) ──

const ERROR_MAP: Record<string, string> = {
  // Idempotency (02-data-layer §4.5)
  IDEMPOTENCY_KEY_REQUIRED: "请求缺少幂等键，请刷新重试",
  IDEMPOTENCY_BODY_MISMATCH: "请求内容已变更，请重新提交",

  // Auth / common (02-data-layer §4.1)
  INVALID_PARAM: "参数有误，请检查输入",
  INVALID_BODY: "请求体格式有误",
  UNAUTHORIZED: "登录已失效，请重新登录",
  TOKEN_EXPIRED: "登录已过期，请重新登录",
  TOKEN_INVALID: "登录凭证无效，请重新登录",
  INSUFFICIENT_ROLE: "无权限执行此操作",
  RATE_LIMITED: "操作过于频繁，请稍候重试",
  INTERNAL_ERROR: "服务异常，请稍后重试",

  // admin-users (02-data-layer §4.3)
  ADMIN_USER_EXISTS: "该 Lark 用户已是管理员",
  ADMIN_USER_NOT_FOUND: "目标管理员不存在（可能已被删除）",
  LAST_SUPER_ADMIN: "不能降级/删除最后一个超级管理员",
  CANNOT_REMOVE_SELF: "不能删除当前登录的自己",

  // presale business (02-data-layer §4.4 — source-of-truth: web-api handler source)
  NOTE_REQUIRED: "操作备注至少 10 个字符",
  ROUND_NOT_FOUND: "记录不存在或已变更",
  DEPOSIT_NOT_FOUND: "记录不存在或已变更",
  ANOMALY_NOT_FOUND: "记录不存在或已变更",
  INVALID_STATE_TRANSITION: "当前状态不允许此操作（如已结束的轮次不能暂停）",
  MIGRATE_LIMIT_EXCEEDED: "该入账迁移次数已达上限",
  BLOCK_TIMESTAMP_OUT_OF_RANGE: "该入账区块时间不在目标轮次时间窗内（含容差），不能迁入",
  TARGET_ROUND_NOT_FOUND: "目标轮次不存在",

  // events 赛事风险（DD002 §3.2；终态码 NOT_RED/CONFLICT 通常在 useRiskDecision 截获，这里兜底）
  EVENT_NOT_FOUND: "赛事不存在或已变更",
  EVENT_NOT_RED_SIGNAL: "该赛事已不是红灯，无需人工决策",
  RISK_DECISION_CONFLICT: "已有其他管理员处理过该赛事",
  UPSTREAM_UNAVAILABLE: "上游服务暂不可用，请稍后重试",
};

function mapError(err: unknown): string {
  if (err instanceof ApiError) {
    const mapped = ERROR_MAP[err.errorCode];
    if (mapped) return mapped;
    // Fallback: use the message from the server but never expose a stack trace.
    return err.message || `操作失败（${err.errorCode}）`;
  }
  // Network-level errors (TypeError: failed to fetch, AbortError, etc.)
  if (err instanceof TypeError || (err instanceof Error && err.name === "AbortError")) {
    return "网络异常，请稍后重试";
  }
  // ky HTTPError that somehow bypassed unwrap (should not happen, but defensive)
  if (err instanceof Error && err.name === "HTTPError") {
    return "网络异常，请稍后重试";
  }
  // Last-resort: stringify but never expose a JS stack
  if (err instanceof Error) {
    return err.message || "未知错误，请稍后重试";
  }
  return String(err) || "未知错误，请稍后重试";
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ConfirmMutationModalProps {
  open: boolean;
  title: string;
  /** 操作对象摘要，逐行 label/value 渲染（AntD Descriptions） */
  target: { label: string; value: string }[];
  /** 影响范围摘要（danger=true 时用 warning Alert，否则 info） */
  impact: React.ReactNode;
  /** 额外字段注入（如 migrate-round 的 targetRoundId 下拉），渲染在 note 之上、impact 之下 */
  extraFields?: React.ReactNode;
  /** 危险操作 → 确认按钮 danger 红（AntD built-in, no hardcoded colours） */
  danger?: boolean;
  /** 默认 true；false → 无 textarea，onConfirm 以 note="" 调用 */
  requireNote?: boolean;
  /** 默认 10；按 rune（Unicode 码点）计数，与后端 len([]rune(note)) 对齐 */
  noteMinLength?: number;
  /** textarea placeholder */
  notePlaceholder?: string;
  /**
   * 提交回调：idempotencyKey 由 Modal 内部生成并传出去。
   * resolve → 成功关闭；reject → 保持打开并就近报错。
   */
  onConfirm: (args: { note: string; idempotencyKey: string }) => Promise<void>;
  onCancel: () => void;
  /** 默认 "确认执行" */
  confirmText?: string;
  /** 默认 "取消" */
  cancelText?: string;
}

interface NoteFormValues {
  note?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ConfirmMutationModal({
  open,
  title,
  target,
  impact,
  extraFields,
  danger = false,
  requireNote = true,
  noteMinLength = 10,
  notePlaceholder = "请输入操作备注（≥10 字符，会落审计）",
  onConfirm,
  onCancel,
  confirmText = "确认执行",
  cancelText = "取消",
}: ConfirmMutationModalProps): React.ReactElement {
  const { token } = theme.useToken();
  const { key: idempotencyKey, rotate } = useIdempotencyKey();
  const [form] = Form.useForm<NoteFormValues>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form fields whenever the modal opens so stale text from a previous session is cleared.
  // We reset on open→true (not on close) to avoid calling setState during a closing transition,
  // which can trigger cascading renders (react-hooks/set-state-in-effect).
  // Error is cleared synchronously inside handleCancel and at the start of handleOk.
  useEffect(() => {
    if (open) {
      form.resetFields();
    }
  }, [open, form]);

  // Wrap onCancel: clear error + let caller close the modal.
  const handleCancel = () => {
    setError(null);
    onCancel();
  };

  const handleOk = async () => {
    // Step 1: AntD form validation (required + rune-length custom validator).
    // validateFields() rejects if invalid — AntD shows inline errors, we just return.
    let validatedNote: string;
    try {
      const values = await form.validateFields();
      validatedNote = values.note ?? "";
    } catch {
      // Validation failure — AntD already shows inline error; do not proceed.
      return;
    }

    // Step 2: Submit.
    setLoading(true);
    setError(null);
    try {
      await onConfirm({ note: validatedNote, idempotencyKey });
      // Success: rotate key (next submit uses a fresh key) then close.
      rotate();
      handleCancel();
    } catch (e) {
      // Rotate key on ANY server-side ApiError — the user will likely retry with a corrected body
      // (e.g., longer note, different targetRoundId, fixed resolution), and reusing the old key
      // with a changed body would trigger 409 IDEMPOTENCY_BODY_MISMATCH on the next attempt.
      // Network errors (HTTPError / TypeError) → keep the key for idempotent retry.
      if (e instanceof ApiError) {
        rotate();
      }
      setError(mapError(e));
    } finally {
      setLoading(false);
    }
  };

  // Custom rune-count validator — AntD's built-in `min` counts UTF-16 code units
  // (surrogate pairs count as 2), but the backend uses len([]rune(note)) (Unicode code points).
  // [...str].length spreads by code point, matching Go's rune semantics.
  const runeValidator = (_: unknown, value: string | undefined) => {
    const runeCount = [...(value ?? "")].length;
    if (runeCount >= noteMinLength) return Promise.resolve();
    return Promise.reject(
      new Error(`备注不少于 ${noteMinLength} 个字符（当前 ${runeCount} 字）`),
    );
  };

  return (
    <Modal
      open={open}
      title={title}
      onCancel={handleCancel}
      maskClosable={!loading}
      closable={!loading}
      okText={confirmText}
      cancelText={cancelText}
      okButtonProps={{ danger, disabled: loading, loading }}
      cancelButtonProps={{ disabled: loading }}
      onOk={handleOk}
      destroyOnHidden={false}
    >
      {/* Error alert — top of modal body */}
      {error ? (
        <Alert
          type="error"
          message={error}
          showIcon
          style={{ marginBottom: token.marginSM }}
        />
      ) : null}

      {/* Target object summary */}
      <Descriptions
        size="small"
        column={1}
        bordered
        items={target.map((t) => ({ label: t.label, children: t.value }))}
        style={{ marginBottom: token.marginSM }}
      />

      {/* Impact summary — warning for danger ops, info otherwise */}
      <Alert
        type={danger ? "warning" : "info"}
        message={impact}
        showIcon={false}
        style={{ marginBottom: token.marginSM }}
      />

      {/* Extra fields (e.g. targetRoundId dropdown for migrate-round) */}
      {extraFields ? (
        <div style={{ marginBottom: token.marginSM }}>{extraFields}</div>
      ) : null}

      {/* Note textarea */}
      {requireNote ? (
        <Form form={form} layout="vertical">
          <Form.Item
            name="note"
            label="操作备注（≥10 字，会落审计）"
            rules={[
              { required: true, message: "请填写备注" },
              { validator: runeValidator },
            ]}
          >
            <Input.TextArea
              rows={3}
              placeholder={notePlaceholder}
              maxLength={500}
              disabled={loading}
            />
          </Form.Item>
        </Form>
      ) : null}
    </Modal>
  );
}
