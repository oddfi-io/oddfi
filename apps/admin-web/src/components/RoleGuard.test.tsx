import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Role } from "@/types/admin-user";

// ── Hoist mock ────────────────────────────────────────────────────────────────
const { mockUsePermissionRole } = vi.hoisted(() => ({
  mockUsePermissionRole: vi.fn<() => { role: Role | null; isLoading: boolean }>(),
}));

vi.mock("@/hooks/usePermissionRole", () => ({
  usePermissionRole: mockUsePermissionRole,
}));

// Import AFTER mocking
import { RoleGuard } from "./RoleGuard";

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function setRole(role: Role | null) {
  mockUsePermissionRole.mockReturnValue({ role, isLoading: false });
}

function renderGuard(allow: Role[], fallback?: React.ReactNode) {
  return render(
    <RoleGuard allow={allow} fallback={fallback ?? null}>
      <span>protected</span>
    </RoleGuard>,
  );
}

// ── super_admin passes everything ─────────────────────────────────────────────

describe("RoleGuard with super_admin", () => {
  it.each([
    ["presale resources", ["operator", "super_admin", "customer_service"] as Role[]],
    ["admin-users (super_admin only)", ["super_admin"] as Role[]],
    ["finance resources", ["finance", "super_admin"] as Role[]],
  ])("super_admin sees: %s", (_label, allow) => {
    setRole("super_admin");
    renderGuard(allow);
    expect(screen.getByText("protected")).toBeInTheDocument();
  });
});

// ── finance role matrix ───────────────────────────────────────────────────────

describe("RoleGuard with finance", () => {
  beforeEach(() => setRole("finance"));

  it("can access finance-allowed resources", () => {
    renderGuard(["finance", "super_admin"]);
    expect(screen.getByText("protected")).toBeInTheDocument();
  });

  it("cannot access admin-users (super_admin only)", () => {
    renderGuard(["super_admin"]);
    expect(screen.queryByText("protected")).not.toBeInTheDocument();
  });

  it("cannot access presale/rounds/deposits (operator/cs only, no finance)", () => {
    renderGuard(["operator", "super_admin", "customer_service"]);
    expect(screen.queryByText("protected")).not.toBeInTheDocument();
  });
});

// ── operator role matrix ──────────────────────────────────────────────────────

describe("RoleGuard with operator", () => {
  beforeEach(() => setRole("operator"));

  it("can access operator-allowed presale resources", () => {
    renderGuard(["operator", "super_admin", "customer_service"]);
    expect(screen.getByText("protected")).toBeInTheDocument();
  });

  it("cannot access admin-users", () => {
    renderGuard(["super_admin"]);
    expect(screen.queryByText("protected")).not.toBeInTheDocument();
  });

  it("cannot access finance-only resources", () => {
    renderGuard(["finance", "super_admin"]);
    expect(screen.queryByText("protected")).not.toBeInTheDocument();
  });
});

// ── customer_service role matrix ──────────────────────────────────────────────

describe("RoleGuard with customer_service", () => {
  beforeEach(() => setRole("customer_service"));

  it("can access presale view resources", () => {
    renderGuard(["operator", "super_admin", "customer_service"]);
    expect(screen.getByText("protected")).toBeInTheDocument();
  });

  it("cannot access admin-users", () => {
    renderGuard(["super_admin"]);
    expect(screen.queryByText("protected")).not.toBeInTheDocument();
  });

  it("cannot access finance-only resources", () => {
    renderGuard(["finance", "super_admin"]);
    expect(screen.queryByText("protected")).not.toBeInTheDocument();
  });
});

// ── undefined / null role (unauthenticated) ───────────────────────────────────

describe("RoleGuard with null role (unauthenticated)", () => {
  it.each([
    [["super_admin"] as Role[]],
    [["operator", "super_admin"] as Role[]],
    [["finance", "super_admin"] as Role[]],
    [["super_admin", "operator", "customer_service", "finance"] as Role[]],
  ])("blocks everything when role is null, allow=%j", (allow) => {
    setRole(null);
    renderGuard(allow);
    expect(screen.queryByText("protected")).not.toBeInTheDocument();
  });
});

// ── multi-role allow (OR semantics) ──────────────────────────────────────────

describe("RoleGuard multi-role allow (OR)", () => {
  it.each([
    ["finance", ["operator", "finance"] as Role[], true],
    ["operator", ["operator", "finance"] as Role[], true],
    ["customer_service", ["operator", "finance"] as Role[], false],
    ["super_admin", ["operator", "finance"] as Role[], false],
  ] as [Role, Role[], boolean][])(
    "role=%s allow=%j → visible=%s",
    (role, allow, visible) => {
      setRole(role);
      renderGuard(allow);
      if (visible) {
        expect(screen.getByText("protected")).toBeInTheDocument();
      } else {
        expect(screen.queryByText("protected")).not.toBeInTheDocument();
      }
    },
  );
});

// ── fallback rendering ────────────────────────────────────────────────────────

describe("RoleGuard fallback", () => {
  it("renders fallback node when role is blocked", () => {
    setRole("customer_service");
    render(
      <RoleGuard allow={["super_admin"]} fallback={<span>no access</span>}>
        <span>protected</span>
      </RoleGuard>,
    );
    expect(screen.getByText("no access")).toBeInTheDocument();
    expect(screen.queryByText("protected")).not.toBeInTheDocument();
  });

  it("renders nothing (null fallback) by default when blocked", () => {
    setRole(null);
    const { container } = renderGuard(["super_admin"]);
    expect(container.firstChild).toBeNull();
  });
});

// ── full 4×N truth table ──────────────────────────────────────────────────────

describe("RoleGuard full 4×N resource truth table", () => {
  const cases: [Role | null, Role[], boolean][] = [
    // rounds / presale (R_VIEW = super_admin | operator | customer_service)
    ["super_admin", ["super_admin", "operator", "customer_service"], true],
    ["operator", ["super_admin", "operator", "customer_service"], true],
    ["customer_service", ["super_admin", "operator", "customer_service"], true],
    ["finance", ["super_admin", "operator", "customer_service"], false],
    [null, ["super_admin", "operator", "customer_service"], false],

    // admin-users (super_admin only)
    ["super_admin", ["super_admin"], true],
    ["operator", ["super_admin"], false],
    ["customer_service", ["super_admin"], false],
    ["finance", ["super_admin"], false],
    [null, ["super_admin"], false],

    // finance resources (finance | super_admin)
    ["super_admin", ["super_admin", "finance"], true],
    ["finance", ["super_admin", "finance"], true],
    ["operator", ["super_admin", "finance"], false],
    ["customer_service", ["super_admin", "finance"], false],
    [null, ["super_admin", "finance"], false],
  ];

  it.each(cases)(
    "role=%s allow=%j → visible=%s",
    (role, allow, expectVisible) => {
      setRole(role);
      renderGuard(allow);
      if (expectVisible) {
        expect(screen.getByText("protected")).toBeInTheDocument();
      } else {
        expect(screen.queryByText("protected")).not.toBeInTheDocument();
      }
    },
  );
});
