import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import CtaCenterDecorIcon from "@/components/icons/landing/CtaCenterDecorIcon";

/**
 * §12 CTA Section
 * Figma 节点: 4227:195333 (Container, 1200×507)
 *
 * 关键规格（来自 Figma design_context）：
 * - 容器 1200×507, border 1px rgba(255,255,255,0.1), rounded-[40px]
 * - 内部 py-[100px], 垂直堆叠 items-center, gap-[56px]
 * - 背景径向渐晕（cta-glow-bg.svg）：节点 4227:195334
 *   - 实际位置 left=-231 top=350.19, w=1560.347 h=879.382 (相对容器), 模糊柔光
 * - 星点蒙层（cta-stars.png）：节点 5633:21931，位于渐晕与内容之间
 *   - 容器 50,0 1100×508 rounded-[15px] overflow-clip opacity-80
 *   - 内层 PNG 比容器大（103.6% × 174.47%）以保留星点纹理细节
 * - Logo 装饰（CtaCenterDecorIcon, 100×75）
 * - H2 标题 "OddFi，下一代链上预测市场" Noto Sans SC Bold 48/64 white
 * - 主按钮 "开始预测" w=160 h=56 rounded-[100px] bg-white text-#04060c
 *
 * Phase 1 静态版：径向渐变静态显示，禁止 4s alternate 呼吸动画。
 */

export default function CtaSection() {
  const t = useTranslations("landing.cta");
  return (
    <section
      data-section="cta"
      data-figma-node="4227:195333"
      className="relative w-full bg-primary py-[120px]"
    >
      {/* 内层固定 1200×507 画布，圆角 40 + 1px 半透明描边 */}
      <div
        // @figma-hardcoded: rgba(255,255,255,0.1) cta-border — pending design token
        className="relative mx-auto h-[507px] w-[1200px] overflow-clip rounded-[40px] border border-solid border-[rgba(255,255,255,0.1)]"
      >
        {/* 径向渐晕背景层（cta-glow-bg.svg）
            - 外层 wrapper 按 Figma 节点 4227:195334 定位/尺寸
            - 内层 inset-[-22.81%_-15.93%] 让 SVG blur halo（viewBox 2057×1280）放大到原始比例溢出可见区
              否则 preserveAspectRatio="none" 会把光斑压扁 + blur 被裁切 */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            left: "-231px",
            top: "350.19px",
            width: "1560.347px",
            height: "879.382px",
          }}
        >
          <div className="absolute inset-[-22.81%_-15.93%]">
            <img
              src="/images/landing/cta-glow-bg.svg"
              alt=""
              className="block size-full max-w-none"
            />
          </div>
        </div>

        {/* 星点蒙层（Figma 节点 5633:21931）— 渐晕之上、内容之下
            - 容器 1100×508，距左/右各 50px；rounded-[15px] + overflow-clip
            - 内层 PNG 放大到 103.6% × 174.47%（top -2.91% / left -1.7%），让星点不被压扁
            - opacity-80 保证不遮挡文字，但提供"星空感"质感 */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[50px] top-0 h-[508px] w-[1100px] overflow-clip rounded-[15px] opacity-80"
        >
          <img
            src="/images/landing/cta-stars.png"
            alt=""
            className="absolute left-[-1.7%] top-[-2.91%] block h-[174.47%] w-[103.6%] max-w-none"
          />
        </div>

        {/* 居中内容栈：Logo + 标题 + 按钮，py-100 + gap-56 */}
        <div className="relative flex h-full w-full flex-col items-center justify-center gap-[56px] py-[100px]">
          {/* 中央 logo 装饰 */}
          <CtaCenterDecorIcon className="h-[75px] w-[100px] shrink-0" />

          {/* 主标题 */}
          <h2
            data-figma-node="4227:195340"
            className="whitespace-nowrap text-center font-noto-sc text-[48px] font-bold leading-[64px] text-white"
          >
            {t("title")}
          </h2>

          {/* CTA 按钮 — 白底黑字 rounded-[100px] */}
          <Link
            data-figma-node="4227:195341"
            href="/markets"
            style={{ touchAction: "manipulation" }}
            // @figma-hardcoded: #04060c btn-text — pending design token
            className="flex h-[56px] w-[160px] items-center justify-center gap-[8px] rounded-[100px] bg-white px-[16px] py-[8px] text-[#04060c]"
          >
            <span className="font-noto-sc text-[16px] font-medium leading-[24px]">
              {t("buttonPredict")}
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
