// /admin-users — 管理员管理列表（M4: 行内改角色 + 删除 + 守卫，super_admin only）。
// snake_case 字段；分页参数 page_size（dataProvider 已适配）。
// 契约：03-pages.md §8，06-acceptance-and-tasks.md M4 T22/T23/T24。
import { useState } from "react";
import { List, useTable } from "@refinedev/antd";
import { useGetIdentity, useInvalidate } from "@refinedev/core";
import type { CrudFilter } from "@refinedev/core";
import {
  App,
  Button,
  Form,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { AdminUser, Role } from "@/types/admin-user";
import { ROLE_NAMES } from "@/types/admin-user";
import type { Identity } from "@/types/admin-user";
import { formatTs } from "@/lib/time";
import { RoleGuard } from "@/components/RoleGuard";
import { ConfirmMutationModal } from "@/components/ConfirmMutationModal";
import { useAdminUsersActions } from "@/hooks/useAdminUsersActions";
import { canDeleteAdminUser, canChangeAdminRole } from "@/lib/adminUsersGuards";

interface FilterForm {
  role?: Role;
  q?: string;
}

const ROLE_OPTIONS = (Object.keys(ROLE_NAMES) as Role[]).map((value) => ({
  value,
  label: ROLE_NAMES[value],
}));

// ── Role downgrade helper ──────────────────────────────────────────────────────
// Hierarchy: super_admin(4) > operator(3) > finance(2) = customer_service(2)
// Moving to a lower or equal-priority tier from a higher one counts as downgrade.

const ROLE_ORDER: Record<Role, number> = {
  super_admin: 4,
  operator: 3,
  finance: 2,
  customer_service: 2,
};

function isRoleDowngrade(currentRole: Role, newRole: Role): boolean {
  return ROLE_ORDER[newRole] < ROLE_ORDER[currentRole];
}

export function AdminUsersList() {
  const [form] = Form.useForm<FilterForm>();
  const { notification } = App.useApp();
  const { tableProps, setFilters } = useTable<AdminUser>({
    resource: "admin-users",
    syncWithLocation: true,
  });
  const invalidate = useInvalidate();
  const { data: identity } = useGetIdentity<Identity>();
  const { changeRole, deleteUser } = useAdminUsersActions();

  // Current user's user_id — used by guards (authProvider stores lark_user_id as user_id in JWT)
  const currentUserId = identity?.user_id;

  // All users in current page — used for last-super_admin guard
  // Note: guards use current page snapshot; backend provides final safety net (LAST_SUPER_ADMIN 400)
  const allUsers: AdminUser[] = (tableProps.dataSource as AdminUser[] | undefined) ?? [];

  // ── Delete modal state ────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  // ── Role change modal state ───────────────────────────────────────────────────
  const [roleChangeTarget, setRoleChangeTarget] = useState<{
    record: AdminUser;
    newRole: Role;
  } | null>(null);

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const onSearch = (values: FilterForm) => {
    const filters: CrudFilter[] = [];
    if (values.role) filters.push({ field: "role", operator: "eq", value: values.role });
    if (values.q?.trim()) filters.push({ field: "q", operator: "eq", value: values.q.trim() });
    setFilters(filters);
  };

  const onReset = () => {
    form.resetFields();
    setFilters([]);
  };

  const handleDeleteConfirm = async ({ note }: { note: string; idempotencyKey: string }) => {
    if (!deleteTarget) return;
    // note is not sent to backend (admin-users DELETE has no body) — only used for audit UI
    void note;
    try {
      await deleteUser(deleteTarget.user_id);
      notification.success({ message: "管理员已删除" });
      await invalidate({ resource: "admin-users", invalidates: ["list"] });
      setDeleteTarget(null);
    } catch (e) {
      console.error("[AdminUsersList] Failed to delete admin user", e);
      throw e; // ConfirmMutationModal mapError 自显示
    }
  };

  const openDeleteModal = (record: AdminUser) => {
    const guard = canDeleteAdminUser(record, currentUserId, allUsers);
    if (!guard.ok) {
      notification.warning({ message: guard.message ?? "操作不被允许" });
      return;
    }
    setDeleteTarget(record);
  };

  // ── Last-super-admin select disabled helper ────────────────────────────────

  const superAdminCount = allUsers.filter((u) => u.role === "super_admin").length;

  return (
    <>
      <List
        title="管理员管理"
        createButtonProps={{ children: "新增管理员" }}
      >
        <Form<FilterForm>
          form={form}
          layout="inline"
          onFinish={onSearch}
          style={{ marginBottom: 16, rowGap: 8 }}
        >
          <Form.Item name="role" label="角色">
            <Select allowClear placeholder="全部" options={ROLE_OPTIONS} style={{ width: 140 }} />
          </Form.Item>
          <Form.Item name="q" label="关键词">
            <Input allowClear placeholder="姓名/邮箱" style={{ width: 200 }} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                查询
              </Button>
              <Button onClick={onReset}>重置</Button>
            </Space>
          </Form.Item>
        </Form>

        <Table<AdminUser> {...tableProps} rowKey="user_id">
          <Table.Column<AdminUser>
            title="姓名"
            dataIndex="name"
            render={(v: string) => <Typography.Text strong>{v}</Typography.Text>}
          />
          <Table.Column<AdminUser>
            title="邮箱"
            dataIndex="email"
            render={(v: string) => v || <Typography.Text type="secondary">—</Typography.Text>}
          />
          <Table.Column<AdminUser>
            title="角色"
            dataIndex="role"
            render={(v: Role, record: AdminUser) => {
              // M-1: disable the Select only when this user is the last super_admin
              const isLastSuperAdmin = record.role === "super_admin" && superAdminCount <= 1;
              return (
                <RoleGuard
                  allow={["super_admin"]}
                  fallback={<Tag>{ROLE_NAMES[v] ?? v}</Tag>}
                >
                  <Select<Role>
                    value={v}
                    options={ROLE_OPTIONS}
                    style={{ width: 140 }}
                    disabled={isLastSuperAdmin}
                    onChange={(newRole) => {
                      if (newRole === record.role) return;
                      // Guard pre-check before opening modal
                      const guard = canChangeAdminRole(record, newRole, currentUserId, allUsers);
                      if (!guard.ok) {
                        notification.warning({ message: guard.message ?? "无法更改角色" });
                        return;
                      }
                      setRoleChangeTarget({ record, newRole });
                    }}
                  />
                </RoleGuard>
              );
            }}
          />
          <Table.Column<AdminUser>
            title="创建人"
            dataIndex="created_by"
            render={(v: string) => (
              <Typography.Text code>{v || "—"}</Typography.Text>
            )}
          />
          <Table.Column<AdminUser>
            title="创建时间 (+08)"
            dataIndex="created_at"
            render={(v: string) => formatTs(v)}
          />
          <Table.Column<AdminUser>
            title="操作"
            key="actions"
            render={(_: unknown, record: AdminUser) => {
              const deleteGuard = canDeleteAdminUser(record, currentUserId, allUsers);
              return (
                <RoleGuard allow={["super_admin"]}>
                  <Tooltip
                    title={deleteGuard.ok ? undefined : deleteGuard.message}
                  >
                    <Button
                      danger
                      size="small"
                      disabled={!deleteGuard.ok}
                      onClick={() => openDeleteModal(record)}
                    >
                      删除
                    </Button>
                  </Tooltip>
                </RoleGuard>
              );
            }}
          />
        </Table>
      </List>

      {/* Delete confirmation modal — high-sensitivity operation */}
      <ConfirmMutationModal
        open={deleteTarget !== null}
        title="删除管理员"
        danger
        requireNote={false}
        target={
          deleteTarget
            ? [
                { label: "姓名", value: deleteTarget.name },
                { label: "邮箱", value: deleteTarget.email || "—" },
                { label: "角色", value: ROLE_NAMES[deleteTarget.role] ?? deleteTarget.role },
              ]
            : []
        }
        impact="删除后该管理员将立即失去系统访问权限，且无法撤销。"
        confirmText="确认删除"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Role change confirmation modal (H-2) */}
      {roleChangeTarget && (
        <ConfirmMutationModal
          open={roleChangeTarget !== null}
          title="修改管理员角色"
          target={[
            {
              label: "管理员",
              value: roleChangeTarget.record.name ?? roleChangeTarget.record.user_id,
            },
            {
              label: "当前角色",
              value: ROLE_NAMES[roleChangeTarget.record.role] ?? roleChangeTarget.record.role,
            },
            {
              label: "目标角色",
              value: ROLE_NAMES[roleChangeTarget.newRole] ?? roleChangeTarget.newRole,
            },
          ]}
          impact="角色变更后即时生效。降级会立刻收回部分模块的访问权限。"
          danger={isRoleDowngrade(roleChangeTarget.record.role, roleChangeTarget.newRole)}
          requireNote={false}
          onConfirm={async () => {
            if (!roleChangeTarget) return;
            try {
              await changeRole(roleChangeTarget.record.user_id, { role: roleChangeTarget.newRole });
              notification.success({ message: "角色已更新" });
              await invalidate({ resource: "admin-users", invalidates: ["list"] });
              setRoleChangeTarget(null);
            } catch (e) {
              console.error("[AdminUsersList] Failed to change role", e);
              throw e;
            }
          }}
          onCancel={() => setRoleChangeTarget(null)}
        />
      )}
    </>
  );
}
