/**
 * 代币核心指标（DD-146 B7）— Figma PC 8604:118181 / H5 8754:107630
 * 文案走 i18n token.metrics.*（zh 中文 / 其余英文）。
 *
 * 4 个 KPI 指标卡：总发行量 / 10 档销售价 / DEX 开盘价 / 销售募资上限。
 * Section 底部带薄荷渐变（@figma-hardcoded），圆角下沿 36px(PC)/16px(H5)。
 * PC：标题居中 + 横向一排 4 卡（panel-gradient-border rounded-16 p-8，值 Orbitron 32px brand）；
 * H5：标题居中 + 2×2 网格（rounded-8 p-4，值 18px brand，desc text-tertiary）。
 * 纯静态展示，无 props。
 */

import { useTranslations } from "next-intl";

interface MetricCardData {
  value: string;
  label: string;
  desc: string;
}

export default function TokenMetrics() {
  const t = useTranslations("token");
  const metrics = t.raw("metrics.items") as MetricCardData[];
  return (
    <section data-figma-pc="8604:118181" data-figma-h5="8754:107630" className="w-full">
      {/* ───────── H5（< md）：标题居中 + 2×2 网格 ───────── */}
      {/* @figma-hardcoded: linear-gradient mint section-bg — pending design token */}
      <div
        className="flex flex-col items-center gap-6 rounded-[16px] px-4 pb-14 pt-10 md:hidden"
        style={{
          backgroundImage:
            "linear-gradient(159.641deg, rgb(13,13,15) 75.64%, rgba(40,244,210,0.7) 98.056%, rgb(40,244,210) 130.72%)",
        }}
      >
        <h2 className="font-orbitron text-[24px] font-bold leading-8 tracking-[-0.24px] text-primary">
          {t("metrics.title")}
        </h2>
        <div className="grid w-full grid-cols-2 gap-4">
          {metrics.map((m) => (
            <div
              key={m.label}
              className="panel-gradient-border flex flex-col justify-center gap-2 rounded-[8px] p-4"
            >
              <span className="font-noto-sc text-[18px] font-bold leading-[26px] text-brand-default">
                {m.value}
              </span>
              <span className="font-noto-sc text-[14px] font-medium leading-[18px] text-primary">
                {m.label}
              </span>
              <span className="font-noto-sc text-[12px] font-normal leading-[18px] text-tertiary">
                {m.desc}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ───────── PC（md+）：标题居中 + 横向 4 卡 ───────── */}
      {/* @figma-hardcoded: linear-gradient mint section-bg — pending design token */}
      <div
        className="hidden w-full rounded-bl-[36px] rounded-br-[36px] md:block"
        style={{
          backgroundImage:
            "linear-gradient(166.343deg, rgb(4,6,12) 64.539%, rgba(40,244,210,0.7) 101.71%, rgb(40,244,210) 155.89%)",
        }}
      >
        <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-10 px-[120px] py-[120px]">
          <h2 className="font-orbitron text-[48px] font-bold leading-[64px] tracking-[-1.44px] text-primary">
            {t("metrics.title")}
          </h2>
          <div className="grid w-full grid-cols-4 gap-6">
            {metrics.map((m) => (
              <div
                key={m.label}
                className="panel-gradient-border flex flex-col justify-center gap-2 rounded-[16px] p-8"
              >
                <span className="font-orbitron text-[32px] font-bold leading-10 tracking-[-0.32px] text-brand-default">
                  {m.value}
                </span>
                <span className="font-noto-sc text-[16px] font-medium leading-6 text-primary">
                  {m.label}
                </span>
                <span className="font-noto-sc text-[14px] font-normal leading-[18px] text-secondary">
                  {m.desc}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
