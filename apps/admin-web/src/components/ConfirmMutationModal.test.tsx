// Tests for ConfirmMutationModal.
// Contract: M2-T15; docs/spa-presale-admin/04-components.md §1.
// AntD components need ConfigProvider; matchMedia / ResizeObserver stubs in src/test/setup.ts.
// Note: @testing-library/user-event is not installed; using fireEvent from @testing-library/react.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { ConfigProvider } from "antd";
import { vercelTheme } from "@/theme/vercelTheme";
import { ApiError } from "@/types/api";
import { ConfirmMutationModal } from "./ConfirmMutationModal";
import type { ConfirmMutationModalProps } from "./ConfirmMutationModal";

// ── Helpers ───────────────────────────────────────────────────────────────────

const DEFAULT_TARGET = [
  { label: "轮次 ID", value: "round-001" },
  { label: "当前状态", value: "active" },
];

function renderModal(props: Partial<ConfirmMutationModalProps> = {}) {
  const defaults: ConfirmMutationModalProps = {
    open: true,
    title: "Test Modal",
    target: DEFAULT_TARGET,
    impact: "此操作会暂停当前轮次",
    onConfirm: vi.fn().mockResolvedValue(undefined),
    onCancel: vi.fn(),
  };
  const merged = { ...defaults, ...props };
  return render(
    <ConfigProvider theme={vercelTheme}>
      <ConfirmMutationModal {...merged} />
    </ConfigProvider>,
  );
}

// AntD injects a space between adjacent CJK characters in button text.
// Build a regex that allows an optional space between each character.
function cjkRegex(label: string): RegExp {
  return new RegExp(label.split("").join("\\s?"));
}

function getConfirmButton(label = "确认执行") {
  return screen.getByRole("button", { name: cjkRegex(label) });
}

function getCancelButton(label = "取消") {
  return screen.getByRole("button", { name: cjkRegex(label) });
}

/** Type into a textarea via fireEvent.change */
function typeInto(el: HTMLElement, value: string) {
  fireEvent.change(el, { target: { value } });
}

// UUID v4 pattern: 8-4-4-4-12 hex chars
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Basic rendering ───────────────────────────────────────────────────────────

describe("ConfirmMutationModal basic rendering", () => {
  it("renders title when open=true", () => {
    renderModal({ title: "暂停轮次 · 战略轮" });
    expect(screen.getByText("暂停轮次 · 战略轮")).toBeInTheDocument();
  });

  it("does not render modal content when open=false", () => {
    renderModal({ open: false, title: "Hidden Modal" });
    expect(screen.queryByText("Hidden Modal")).not.toBeInTheDocument();
  });
});

// ── target rendering ──────────────────────────────────────────────────────────

describe("target rendering", () => {
  it("renders all label/value pairs from target", () => {
    renderModal({
      target: [
        { label: "轮次 ID", value: "round-42" },
        { label: "当前状态", value: "paused" },
      ],
    });
    expect(screen.getByText("轮次 ID")).toBeInTheDocument();
    expect(screen.getByText("round-42")).toBeInTheDocument();
    expect(screen.getByText("当前状态")).toBeInTheDocument();
    expect(screen.getByText("paused")).toBeInTheDocument();
  });

  it("renders empty Descriptions without crashing when target is []", () => {
    renderModal({ target: [] });
    // Modal still opens and shows the impact area
    expect(screen.getByText("此操作会暂停当前轮次")).toBeInTheDocument();
  });
});

// ── impact rendering ──────────────────────────────────────────────────────────

describe("impact rendering", () => {
  it("renders plain string impact", () => {
    renderModal({ impact: "影响范围：所有用户" });
    expect(screen.getByText("影响范围：所有用户")).toBeInTheDocument();
  });

  it("renders ReactNode impact", () => {
    renderModal({ impact: <span data-testid="impact-node">复杂影响</span> });
    expect(screen.getByTestId("impact-node")).toBeInTheDocument();
  });
});

// ── extraFields rendering ─────────────────────────────────────────────────────

describe("extraFields rendering", () => {
  it("renders extraFields when provided", () => {
    renderModal({ extraFields: <div data-testid="extra-field">目标轮次下拉</div> });
    expect(screen.getByTestId("extra-field")).toBeInTheDocument();
  });

  it("does not render extraFields slot when not provided", () => {
    renderModal({ extraFields: undefined });
    // Just ensure the modal renders without crashing
    expect(screen.getByText("此操作会暂停当前轮次")).toBeInTheDocument();
  });
});

// ── requireNote=false ─────────────────────────────────────────────────────────

describe("requireNote=false", () => {
  it("does not render a textarea", () => {
    renderModal({ requireNote: false });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("calls onConfirm with note='' and a uuid idempotencyKey when confirm clicked", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    renderModal({ requireNote: false, onConfirm });

    await act(async () => {
      fireEvent.click(getConfirmButton());
    });

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledOnce();
      const args = onConfirm.mock.calls[0][0] as { note: string; idempotencyKey: string };
      expect(args.note).toBe("");
      expect(args.idempotencyKey).toMatch(UUID_V4_RE);
    });
  });
});

// ── requireNote=true — rune-count validation ──────────────────────────────────

describe("requireNote=true — rune-count validation", () => {
  it("renders textarea when requireNote=true (default)", () => {
    renderModal();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("does NOT call onConfirm when note is empty", async () => {
    const onConfirm = vi.fn();
    renderModal({ requireNote: true, onConfirm });

    await act(async () => {
      fireEvent.click(getConfirmButton());
    });

    await waitFor(() => {
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  it("blocks submission when note has 9 BMP characters (< 10 runes)", async () => {
    const onConfirm = vi.fn();
    renderModal({ requireNote: true, noteMinLength: 10, onConfirm });

    // 9 CJK characters — each is 1 rune but < 10
    typeInto(screen.getByRole("textbox"), "九字测试备注一二三");

    await act(async () => {
      fireEvent.click(getConfirmButton());
    });

    await waitFor(() => {
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  it("blocks submission when emoji string has high UTF-16 length but < 10 runes (M-Test-1)", async () => {
    const onConfirm = vi.fn();
    renderModal({ requireNote: true, noteMinLength: 10, onConfirm });

    // "短备注👨‍👩‍👧🚀" — UTF-16 length >> 10, but rune count is much less than 10
    const emojiNote = "短备注👨‍👩‍👧🚀";
    // Sanity: confirm UTF-16 length > rune count
    expect(emojiNote.length).toBeGreaterThan([...emojiNote].length);
    expect([...emojiNote].length).toBeLessThan(10);

    typeInto(screen.getByRole("textbox"), emojiNote);

    await act(async () => {
      fireEvent.click(getConfirmButton());
    });

    await waitFor(() => {
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  it("allows submission when note has exactly 10 runes", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    renderModal({ requireNote: true, noteMinLength: 10, onConfirm });

    // Exactly 10 BMP characters = 10 runes
    const tenCharNote = "十字备注测试通过完成";
    expect([...tenCharNote].length).toBe(10);

    typeInto(screen.getByRole("textbox"), tenCharNote);

    await act(async () => {
      fireEvent.click(getConfirmButton());
    });

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledOnce();
      const args = onConfirm.mock.calls[0][0] as { note: string; idempotencyKey: string };
      expect(args.note).toBe(tenCharNote);
    });
  });

  it("allows submission when note has > 10 runes", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    renderModal({ requireNote: true, noteMinLength: 10, onConfirm });

    const validNote = "这是一条合规备注文字超过十个字符";
    expect([...validNote].length).toBeGreaterThanOrEqual(10);

    typeInto(screen.getByRole("textbox"), validNote);

    await act(async () => {
      fireEvent.click(getConfirmButton());
    });

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledOnce();
    });
  });
});

// ── idempotencyKey — success path & key rotation ─────────────────────────────

describe("idempotencyKey — success path", () => {
  it("passes idempotencyKey as uuid v4 on success", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    renderModal({ requireNote: false, onConfirm });

    await act(async () => {
      fireEvent.click(getConfirmButton());
    });

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledOnce();
      const { idempotencyKey } = onConfirm.mock.calls[0][0] as { note: string; idempotencyKey: string };
      expect(idempotencyKey).toMatch(UUID_V4_RE);
    });
  });

  it("rotates key after success — second open uses a different key", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn();

    const { rerender } = render(
      <ConfigProvider theme={vercelTheme}>
        <ConfirmMutationModal
          open={true}
          title="Rotate Test"
          target={DEFAULT_TARGET}
          impact="影响"
          requireNote={false}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      </ConfigProvider>,
    );

    // First submission
    await act(async () => {
      fireEvent.click(getConfirmButton());
    });
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    const firstKey = (onConfirm.mock.calls[0][0] as { idempotencyKey: string }).idempotencyKey;

    // Simulate close → re-open
    await act(async () => {
      rerender(
        <ConfigProvider theme={vercelTheme}>
          <ConfirmMutationModal
            open={false}
            title="Rotate Test"
            target={DEFAULT_TARGET}
            impact="影响"
            requireNote={false}
            onConfirm={onConfirm}
            onCancel={onCancel}
          />
        </ConfigProvider>,
      );
    });
    await act(async () => {
      rerender(
        <ConfigProvider theme={vercelTheme}>
          <ConfirmMutationModal
            open={true}
            title="Rotate Test"
            target={DEFAULT_TARGET}
            impact="影响"
            requireNote={false}
            onConfirm={onConfirm}
            onCancel={onCancel}
          />
        </ConfigProvider>,
      );
    });

    // Second submission
    await act(async () => {
      fireEvent.click(getConfirmButton());
    });
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(2));
    const secondKey = (onConfirm.mock.calls[1][0] as { idempotencyKey: string }).idempotencyKey;

    expect(firstKey).toMatch(UUID_V4_RE);
    expect(secondKey).toMatch(UUID_V4_RE);
    expect(firstKey).not.toBe(secondKey);
  });
});

// ── failure: IDEMPOTENCY_BODY_MISMATCH — key must rotate ─────────────────────

describe("failure — IDEMPOTENCY_BODY_MISMATCH", () => {
  it("shows error Alert on BODY_MISMATCH failure", async () => {
    const onConfirm = vi
      .fn()
      .mockRejectedValueOnce(
        new ApiError("IDEMPOTENCY_BODY_MISMATCH", 409, "body mismatch"),
      );
    renderModal({ requireNote: false, onConfirm });

    await act(async () => {
      fireEvent.click(getConfirmButton());
    });

    await waitFor(() => {
      expect(screen.getByText("请求内容已变更，请重新提交")).toBeInTheDocument();
    });
  });

  it("rotates key after BODY_MISMATCH — second confirm uses a different key", async () => {
    // First call throws BODY_MISMATCH; second call succeeds.
    const onConfirm = vi
      .fn()
      .mockRejectedValueOnce(
        new ApiError("IDEMPOTENCY_BODY_MISMATCH", 409, "body mismatch"),
      )
      .mockResolvedValueOnce(undefined);

    renderModal({ requireNote: false, onConfirm });

    // First submit — should fail with BODY_MISMATCH
    await act(async () => {
      fireEvent.click(getConfirmButton());
    });
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    const key1 = (onConfirm.mock.calls[0][0] as { idempotencyKey: string }).idempotencyKey;

    // Second submit — should succeed with a new key
    await act(async () => {
      fireEvent.click(getConfirmButton());
    });
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(2));
    const key2 = (onConfirm.mock.calls[1][0] as { idempotencyKey: string }).idempotencyKey;

    expect(key1).toMatch(UUID_V4_RE);
    expect(key2).toMatch(UUID_V4_RE);
    expect(key1).not.toBe(key2);
  });
});

// ── failure: NOTE_REQUIRED (any server ApiError) — key MUST rotate ────────────

describe("failure — NOTE_REQUIRED (other 4xx)", () => {
  it("shows mapped error text for NOTE_REQUIRED", async () => {
    const onConfirm = vi
      .fn()
      .mockRejectedValueOnce(new ApiError("NOTE_REQUIRED", 400, "note required"));
    renderModal({ requireNote: false, onConfirm });

    await act(async () => {
      fireEvent.click(getConfirmButton());
    });

    await waitFor(() => {
      expect(screen.getByText("操作备注至少 10 个字符")).toBeInTheDocument();
    });
  });

  it("rotates key after NOTE_REQUIRED failure — retried confirm uses a fresh key (user will change body)", async () => {
    const onConfirm = vi
      .fn()
      .mockRejectedValueOnce(new ApiError("NOTE_REQUIRED", 400, "note required"))
      .mockResolvedValueOnce(undefined);

    renderModal({ requireNote: false, onConfirm });

    // First submit — fails with NOTE_REQUIRED
    await act(async () => {
      fireEvent.click(getConfirmButton());
    });
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    const key1 = (onConfirm.mock.calls[0][0] as { idempotencyKey: string }).idempotencyKey;

    // Second submit — succeeds
    await act(async () => {
      fireEvent.click(getConfirmButton());
    });
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(2));
    const key2 = (onConfirm.mock.calls[1][0] as { idempotencyKey: string }).idempotencyKey;

    // Different key — server-side ApiError means user will retry with corrected body,
    // so the old key is rotated to avoid 409 IDEMPOTENCY_BODY_MISMATCH.
    expect(key1).not.toBe(key2);
    expect(key1).toMatch(UUID_V4_RE);
    expect(key2).toMatch(UUID_V4_RE);
  });
});

// ── failure: network / HTTPError — key must NOT rotate ───────────────────────

describe("failure — network / HTTPError", () => {
  it("shows '网络异常' message for TypeError (network)", async () => {
    const onConfirm = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    renderModal({ requireNote: false, onConfirm });

    await act(async () => {
      fireEvent.click(getConfirmButton());
    });

    await waitFor(() => {
      expect(screen.getByText("网络异常，请稍后重试")).toBeInTheDocument();
    });
  });

  it("does NOT rotate key after network failure", async () => {
    const onConfirm = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(undefined);

    renderModal({ requireNote: false, onConfirm });

    // First submit — network failure
    await act(async () => {
      fireEvent.click(getConfirmButton());
    });
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    const key1 = (onConfirm.mock.calls[0][0] as { idempotencyKey: string }).idempotencyKey;

    // Second submit — succeeds
    await act(async () => {
      fireEvent.click(getConfirmButton());
    });
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(2));
    const key2 = (onConfirm.mock.calls[1][0] as { idempotencyKey: string }).idempotencyKey;

    // Same key — safe idempotent retry
    expect(key1).toBe(key2);
  });
});

// ── loading state ─────────────────────────────────────────────────────────────

describe("loading state", () => {
  it("confirm button is in loading + disabled state while onConfirm is pending", async () => {
    let resolveConfirm!: () => void;
    const onConfirm = vi.fn().mockReturnValue(
      new Promise<void>((res) => { resolveConfirm = res; }),
    );
    renderModal({ requireNote: false, onConfirm });

    // Click confirm — do NOT await, so the promise stays pending
    fireEvent.click(getConfirmButton());

    // Wait for loading state to appear
    await waitFor(() => {
      const btn = getConfirmButton();
      expect(btn).toBeDisabled();
      expect(btn.classList.contains("ant-btn-loading")).toBe(true);
    });

    // Textarea should also be disabled when requireNote=true
    renderModal({ requireNote: true });

    // Resolve to avoid dangling promise
    resolveConfirm();
  });

  it("textarea is disabled while loading (requireNote=true)", async () => {
    let resolveConfirm!: () => void;
    const onConfirm = vi.fn().mockReturnValue(
      new Promise<void>((res) => { resolveConfirm = res; }),
    );
    renderModal({ requireNote: true, noteMinLength: 0, onConfirm });

    const textarea = screen.getByRole("textbox");
    // Type enough to pass validation (noteMinLength=0 means any text passes)
    typeInto(textarea, "x");

    fireEvent.click(getConfirmButton());

    await waitFor(() => {
      expect(screen.getByRole("textbox")).toBeDisabled();
    });

    resolveConfirm();
  });
});

// ── danger prop ───────────────────────────────────────────────────────────────

describe("danger prop", () => {
  it("confirm button has ant-btn-dangerous class when danger=true", () => {
    renderModal({ danger: true });
    const btn = getConfirmButton();
    expect(btn.classList.contains("ant-btn-dangerous")).toBe(true);
  });

  it("confirm button does NOT have ant-btn-dangerous class when danger=false", () => {
    renderModal({ danger: false });
    const btn = getConfirmButton();
    expect(btn.classList.contains("ant-btn-dangerous")).toBe(false);
  });
});

// ── cancel behaviour ──────────────────────────────────────────────────────────

describe("cancel behaviour", () => {
  it("calls onCancel when cancel button is clicked", async () => {
    const onCancel = vi.fn();
    renderModal({ onCancel });

    await act(async () => {
      fireEvent.click(getCancelButton());
    });

    expect(onCancel).toHaveBeenCalledOnce();
  });
});

// ── custom button labels ──────────────────────────────────────────────────────

describe("custom button labels", () => {
  it("renders custom confirmText", () => {
    renderModal({ confirmText: "执行操作" });
    expect(screen.getByRole("button", { name: cjkRegex("执行操作") })).toBeInTheDocument();
  });

  it("renders custom cancelText", () => {
    renderModal({ cancelText: "放弃" });
    expect(screen.getByRole("button", { name: cjkRegex("放弃") })).toBeInTheDocument();
  });
});

// ── form reset on re-open ─────────────────────────────────────────────────────

describe("form reset on re-open", () => {
  it("textarea is empty and error is cleared after modal is closed and re-opened", async () => {
    const onCancel = vi.fn();

    const { rerender } = render(
      <ConfigProvider theme={vercelTheme}>
        <ConfirmMutationModal
          open={true}
          title="Reset Test"
          target={DEFAULT_TARGET}
          impact="影响"
          requireNote={true}
          onConfirm={vi.fn().mockRejectedValueOnce(new ApiError("NOTE_REQUIRED", 400, "note required"))}
          onCancel={onCancel}
        />
      </ConfigProvider>,
    );

    // Type something, trigger an error
    const textarea = screen.getByRole("textbox");
    typeInto(textarea, "x");

    // Close the modal
    await act(async () => {
      rerender(
        <ConfigProvider theme={vercelTheme}>
          <ConfirmMutationModal
            open={false}
            title="Reset Test"
            target={DEFAULT_TARGET}
            impact="影响"
            requireNote={true}
            onConfirm={vi.fn()}
            onCancel={onCancel}
          />
        </ConfigProvider>,
      );
    });

    // Re-open
    await act(async () => {
      rerender(
        <ConfigProvider theme={vercelTheme}>
          <ConfirmMutationModal
            open={true}
            title="Reset Test"
            target={DEFAULT_TARGET}
            impact="影响"
            requireNote={true}
            onConfirm={vi.fn()}
            onCancel={onCancel}
          />
        </ConfigProvider>,
      );
    });

    // Textarea should be empty; no error alert (impact Alert is always present,
    // but the error-specific text should be gone after reset)
    await waitFor(() => {
      const ta = screen.getByRole("textbox") as HTMLTextAreaElement;
      expect(ta.value).toBe("");
    });
    // The error message text from the previous session should not be visible
    expect(screen.queryByText("操作备注至少 10 个字符")).not.toBeInTheDocument();
  });
});
