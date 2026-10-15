/**
 * CTA Section 中央"开始预测"上方的 3D 渐变 logo 装饰（Figma 节点 4227:195339）
 * 100×75 矢量插画，渐变青→紫蓝。
 *
 * 已查 ASSETS.md（关键词：cta, logo, decor, vector）— 无替代，新建理由：
 * CTA 区中央独有装饰图，仅 §12 使用。
 */
type Props = {
  className?: string;
};

export default function CtaCenterDecorIcon({ className }: Props) {
  return (
    <img
      src="/images/landing/cta-logo-3d.svg"
      alt=""
      aria-hidden="true"
      className={className}
      width={100}
      height={75}
    />
  );
}
