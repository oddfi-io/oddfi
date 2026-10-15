// /kol-referral — KOL 特殊返佣（REQ-004）。查看：cs+；增删改：super_admin（按钮级 RoleGuard）。
// ⚠️ 所有 presale 写接口经 noteValidatorMW：note 必填且 ≥10 runes（同时存为 KOL 备注 + 充当审计备注）。
// 故新增/编辑表单备注必填 ≥10；删除走 ConfirmMutationModal（自带 note≥10 校验 + NOTE_REQUIRED 映射）。
// 契约：oddfi-admin-backend/internal/handler/presale_kol_referral.go + router.go noteValidatorMW，REQ-004。
import { useEffect, useState } from "react";
import { List, useTable } from "@refinedev/antd";
import { useInvalidate } from "@refinedev/core";
import type { CrudFilter } from "@refinedev/core";
import { App, Button, Form, Input, InputNumber, Modal, Space, Table, Typography } from "antd";
import type { KolReferral } from "@/types/presale";
import { ApiError } from "@/types/api";
import { formatTs } from "@/lib/time";
import { formatAmount } from "@/lib/amount";
import { TxHashLink } from "@/components/TxHashLink";
import { RoleGuard } from "@/components/RoleGuard";
import { ConfirmMutationModal } from "@/components/ConfirmMutationModal";
import { useKolReferralActions } from "@/hooks/useKolReferralActions";

// BSC EOA 校验：0x + 40 位十六进制（与后端 eoaRegex 一致）。
const EOA_RE = /^0x[a-fA-F0-9]{40}$/;
// 后端 noteValidatorMW 强制 note ≥10 runes。
const NOTE_MIN = 10;

// 错误码 → 中文提示。
const ERROR_MSG: Record<string, string> = {
  KOL_NOT_FOUND: "该 KOL 记录不存在（可能已被删除）",
  KOL_REFERRAL_PCT_INVALID: "返佣比例无效，须为 0~100 之间的数字",
  NOTE_REQUIRED: "操作备注至少 10 个字符",
  INVALID_PARAM: "参数有误，请检查输入",
  INSUFFICIENT_ROLE: "无权限执行此操作",
  INTERNAL_ERROR: "服务异常，请稍后重试",
};

function mapErr(e: unknown, fallback: string): string {
  if (e instanceof ApiError) return ERROR_MSG[e.errorCode] ?? `${fallback}（${e.errorCode}）`;
  return fallback;
}

// 返佣比例展示：decimal-safe，"8.0000" → "8.00%"。
function formatPct(v: string): string {
  const s = formatAmount(v, { decimals: 2 });
  return s === "—" ? "—" : `${s}%`;
}

// 按 Unicode 码点计数（与后端 len([]rune(note)) 对齐，emoji 不会被算 2）。
const runeLen = (v: string | undefined) => [...(v ?? "")].length;

interface SearchForm {
  eoa?: string;
}

interface KolFormValues {
  referrerEoa: string;
  referralPct: string;
  note: string;
}

export function KolReferralList() {
  const { notification } = App.useApp();
  const [searchForm] = Form.useForm<SearchForm>();
  const { tableProps, setFilters } = useTable<KolReferral>({
    resource: "kol-referral",
    syncWithLocation: true,
  });
  const invalidate = useInvalidate();
  const { createKol, updateKol, deleteKol } = useKolReferralActions();

  // null = 关闭；{ record: null } = 新增；{ record } = 编辑。
  const [editing, setEditing] = useState<{ record: KolReferral | null } | null>(null);
  // 删除目标（走 ConfirmMutationModal，note≥10）。
  const [deleteTarget, setDeleteTarget] = useState<KolReferral | null>(null);

  const onSearch = (values: SearchForm) => {
    const filters: CrudFilter[] = [];
    if (values.eoa?.trim()) filters.push({ field: "eoa", operator: "eq", value: values.eoa.trim() });
    setFilters(filters);
  };

  const onReset = () => {
    searchForm.resetFields();
    setFilters([]);
  };

  const refresh = () => invalidate({ resource: "kol-referral", invalidates: ["list"] });

  return (
    <>
      <List
        title="特殊返佣"
        headerButtons={
          <RoleGuard allow={["super_admin"]}>
            <Button type="primary" onClick={() => setEditing({ record: null })}>
              新增 KOL
            </Button>
          </RoleGuard>
        }
      >
        <Form<SearchForm>
          form={searchForm}
          layout="inline"
          onFinish={onSearch}
          style={{ marginBottom: 16, rowGap: 8 }}
        >
          <Form.Item name="eoa" label="EOA">
            <Input allowClear placeholder="0x…（模糊搜索）" style={{ width: 380 }} />
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

        <Table<KolReferral> {...tableProps} rowKey="referrerEoa">
          <Table.Column<KolReferral>
            title="EOA 地址"
            dataIndex="referrerEoa"
            render={(v: string) => <TxHashLink value={v} kind="address" truncate={false} />}
          />
          <Table.Column<KolReferral>
            title="自定义返佣比例"
            dataIndex="referralPct"
            render={(v: string) => <Typography.Text code>{formatPct(v)}</Typography.Text>}
          />
          <Table.Column<KolReferral>
            title="备注"
            dataIndex="note"
            render={(v: string) => v || <Typography.Text type="secondary">—</Typography.Text>}
          />
          <Table.Column<KolReferral>
            title="操作人"
            dataIndex="createdBy"
            render={(v: string) => <Typography.Text code>{v || "—"}</Typography.Text>}
          />
          <Table.Column<KolReferral>
            title="更新时间 (+08)"
            dataIndex="updatedAt"
            render={(v: number) => formatTs(v)}
          />
          <Table.Column<KolReferral>
            title="操作"
            key="actions"
            render={(_: unknown, record: KolReferral) => (
              <RoleGuard allow={["super_admin"]}>
                <Space>
                  <Button size="small" onClick={() => setEditing({ record })}>
                    编辑
                  </Button>
                  <Button danger size="small" onClick={() => setDeleteTarget(record)}>
                    删除
                  </Button>
                </Space>
              </RoleGuard>
            )}
          />
        </Table>
      </List>

      <RoleGuard allow={["super_admin"]}>
        <KolFormModal
          editing={editing}
          onClose={() => setEditing(null)}
          onSubmit={async (values) => {
            if (editing?.record) {
              await updateKol(editing.record.referrerEoa, {
                referralPct: values.referralPct,
                note: values.note.trim(),
              });
            } else {
              await createKol({
                referrerEoa: values.referrerEoa.trim(),
                referralPct: values.referralPct,
                note: values.note.trim(),
              });
            }
            await refresh();
          }}
        />

        {/* 删除：高敏操作，note≥10 充当审计备注（handler 不转发 note，仅过 noteValidatorMW） */}
        <ConfirmMutationModal
          open={deleteTarget !== null}
          title="删除 KOL 特殊返佣"
          danger
          target={
            deleteTarget
              ? [
                  { label: "EOA", value: deleteTarget.referrerEoa },
                  { label: "当前比例", value: formatPct(deleteTarget.referralPct) },
                ]
              : []
          }
          impact="删除后该 KOL 将回归全局返佣比例，已有入账记录不受影响。"
          confirmText="确认删除"
          onConfirm={async ({ note }) => {
            if (!deleteTarget) return;
            try {
              await deleteKol(deleteTarget.referrerEoa, note);
              notification.success({ message: "已删除" });
              await refresh();
              setDeleteTarget(null);
            } catch (e) {
              console.error("[KolReferralList] Failed to delete kol referral", e);
              throw e; // ConfirmMutationModal 自身 mapError 显示并保持打开
            }
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      </RoleGuard>
    </>
  );
}

// ── 新增/编辑弹窗 ───────────────────────────────────────────────────────────────
// editing.record 为 null = 新增（EOA 可编辑）；非 null = 编辑（EOA 只读）。
// 备注必填 ≥10 字（noteValidatorMW 强制；同时作为 KOL 记录备注 + 审计备注）。

interface KolFormModalProps {
  editing: { record: KolReferral | null } | null;
  onClose: () => void;
  onSubmit: (values: KolFormValues) => Promise<void>;
}

function KolFormModal({ editing, onClose, onSubmit }: KolFormModalProps) {
  const { notification } = App.useApp();
  const [form] = Form.useForm<KolFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const isEdit = editing?.record != null;
  const open = editing != null;

  // 打开时回填（编辑）或清空（新增）。
  useEffect(() => {
    if (!open) return;
    if (editing?.record) {
      form.setFieldsValue({
        referrerEoa: editing.record.referrerEoa,
        referralPct: editing.record.referralPct,
        note: editing.record.note,
      });
    } else {
      form.resetFields();
    }
  }, [open, editing, form]);

  const handleOk = async () => {
    let values: KolFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return; // AntD 已就近显示校验错误
    }
    setSubmitting(true);
    try {
      await onSubmit(values);
      notification.success({ message: isEdit ? "已更新返佣比例" : "已新增 KOL" });
      onClose();
    } catch (e) {
      console.error("[KolFormModal] Failed to submit kol referral", e);
      notification.error({ message: mapErr(e, isEdit ? "更新失败，请稍后重试" : "新增失败，请稍后重试") });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={isEdit ? "编辑返佣比例" : "新增 KOL 特殊返佣"}
      onOk={handleOk}
      onCancel={onClose}
      okText="提交"
      cancelText="取消"
      okButtonProps={{ loading: submitting, disabled: submitting }}
      cancelButtonProps={{ disabled: submitting }}
      maskClosable={!submitting}
      closable={!submitting}
      destroyOnHidden
    >
      <Form<KolFormValues> form={form} layout="vertical">
        <Form.Item
          name="referrerEoa"
          label="EOA 地址"
          rules={[
            { required: true, message: "请输入 EOA 地址" },
            { pattern: EOA_RE, message: "地址格式无效，须为 0x 开头的 40 位十六进制" },
          ]}
        >
          <Input placeholder="0x…" autoComplete="off" disabled={isEdit} />
        </Form.Item>

        <Form.Item
          name="referralPct"
          label="返佣比例 %"
          rules={[{ required: true, message: "请输入返佣比例" }]}
        >
          <InputNumber
            stringMode
            min="0"
            max="100"
            precision={2}
            placeholder="如 8.00"
            style={{ width: "100%" }}
          />
        </Form.Item>

        <Form.Item
          name="note"
          label="备注（≥10 字，会记入操作审计）"
          rules={[
            { required: true, message: "请填写备注" },
            {
              validator: (_, v: string) =>
                runeLen(v) >= NOTE_MIN
                  ? Promise.resolve()
                  : Promise.reject(new Error(`备注不少于 ${NOTE_MIN} 字（当前 ${runeLen(v)} 字）`)),
            },
          ]}
        >
          <Input.TextArea
            rows={3}
            maxLength={200}
            placeholder="如：新增 KOL xxx 的特殊返佣，比例 8%（会落审计，≥10 字）"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
