// /admin-users/create — 新增管理员（M4 实现，super_admin only）。
// 表单字段：Lark user ID / 姓名 / 邮箱 / 角色。created_by 由后端自动填写。
// 契约：docs/spa-presale-admin/03-pages.md §8，06-acceptance-and-tasks.md M4 T22。
// 后端 struct: createAdminUserReq (lark_user_id/lark_name/lark_email/lark_avatar/role)。
import { Create } from "@refinedev/antd";
import { useInvalidate } from "@refinedev/core";
import { App, Form, Input, Select } from "antd";
import { useNavigate } from "react-router-dom";
import { ApiError } from "@/types/api";
import { ROLE_NAMES } from "@/types/admin-user";
import type { Role } from "@/types/admin-user";
import { useAdminUsersActions } from "@/hooks/useAdminUsersActions";

interface CreateForm {
  lark_user_id: string;
  lark_name: string;
  lark_email?: string;
  role: Role;
}

// 错误码 → 用户提示
const ERROR_MSG: Record<string, string> = {
  ADMIN_USER_EXISTS: "该 Lark 用户已是管理员",
  INSUFFICIENT_ROLE: "无权限执行此操作",
  INVALID_PARAM: "参数有误，请检查输入",
  INTERNAL_ERROR: "服务异常，请稍后重试",
};

const ROLE_OPTIONS = (Object.keys(ROLE_NAMES) as Role[]).map((value) => ({
  value,
  label: ROLE_NAMES[value],
}));

export function AdminUsersCreate() {
  const [form] = Form.useForm<CreateForm>();
  const { notification } = App.useApp();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const { createUser } = useAdminUsersActions();

  const onFinish = async (values: CreateForm) => {
    try {
      await createUser({
        lark_user_id: values.lark_user_id.trim(),
        lark_name: values.lark_name.trim(),
        lark_email: values.lark_email?.trim() || undefined,
        role: values.role,
      });
      notification.success({ message: "管理员已创建" });
      await invalidate({ resource: "admin-users", invalidates: ["list"] });
      navigate("/admin-users");
    } catch (e) {
      console.error("[AdminUsersCreate] Failed to create admin user", e);
      let msg = "创建失败，请稍后重试";
      if (e instanceof ApiError) {
        msg = ERROR_MSG[e.errorCode] ?? `创建失败（${e.errorCode}）`;
      }
      notification.error({ message: msg });
    }
  };

  return (
    <Create
      title="新增管理员"
      saveButtonProps={{
        onClick: () => form.submit(),
      }}
    >
      <Form<CreateForm>
        form={form}
        layout="vertical"
        onFinish={onFinish}
        style={{ maxWidth: 480 }}
      >
        <Form.Item
          name="lark_user_id"
          label="Lark User ID"
          rules={[{ required: true, message: "请输入 Lark User ID" }]}
          extra="从飞书开放平台或 /auth/me 接口获取（格式：ou_xxxxxxxxxx）"
        >
          <Input placeholder="ou_xxxxxxxxxx" autoComplete="off" />
        </Form.Item>

        <Form.Item
          name="lark_name"
          label="姓名"
          rules={[{ required: true, message: "请输入姓名" }]}
        >
          <Input placeholder="员工姓名" autoComplete="off" />
        </Form.Item>

        <Form.Item
          name="lark_email"
          label="邮箱"
          rules={[{ type: "email", message: "请输入有效的邮箱地址" }]}
        >
          <Input placeholder="user@example.com（选填）" autoComplete="off" />
        </Form.Item>

        <Form.Item
          name="role"
          label="角色"
          rules={[{ required: true, message: "请选择角色" }]}
        >
          <Select placeholder="选择角色" options={ROLE_OPTIONS} style={{ width: 240 }} />
        </Form.Item>
      </Form>
    </Create>
  );
}
