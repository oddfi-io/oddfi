import Link from "next/link";
import Image from "next/image";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import GlassFloatCard from "./glass/GlassFloatCard";

/**
 * §3 群星落幕夜玻璃墙（Figma 4227:195136 — 1440×4655）
 *
 * - 中间 sticky 标题块（486×336）垂直居中视口
 * - 10 张 327×447 玻璃浮卡按 Figma 绝对坐标分散：
 *   1. messi 2. mbappe 3. yamal 4. ronaldo 5. bellingham
 *   6. haaland 7. son 8. vinicius 9. kane 10. pedri
 * - 每张卡的球员图层在 502×383 wrapper 内有不同 inset（按 Figma 各节点）
 *
 * Phase 1 静态版：保留 sticky，无 stagger / float 呼吸
 */

type Player = {
  id: string;
  figmaId: string;
  left: number;
  top: number;
  imageLayer: React.ReactNode;
};

// 1. 梅西（Figma 5129:96443 → inner div 446×336, left=24 top=-25, img w=101.54% h=100%）
// sizes 取渲染宽度 336 × 101.54% ≈ 342px
const messiLayer = (
  <div className="absolute h-[446px] w-[336px] left-[24px] top-[-25px]">
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <Image
        alt=""
        aria-hidden
        src="/images/landing/players/messi.png"
        width={342}
        height={446}
        priority
        sizes="342px"
        className="absolute h-full top-0 left-0 max-w-none"
        style={{ width: "101.54%" }}
      />
    </div>
  </div>
);

// 2. 姆巴佩（Figma 4227:195140 → div 609×374, left=21 top=35, object-cover）
const mbappeLayer = (
  <div className="absolute h-[609px] w-[374px] left-[21px] top-[35px]">
    <Image
      alt=""
      aria-hidden
      src="/images/landing/players/mbappe.png"
      width={374}
      height={609}
      sizes="384px"
      className="absolute inset-0 size-full max-w-none object-cover pointer-events-none"
    />
  </div>
);

// 3. 亚马尔（Figma 5832:3362 → div 532×236, left=87 top=21, img w=225.05% left=-68.79%）
// sizes 取渲染宽度 236 × 225.05% ≈ 531px
const yamalLayer = (
  <div className="absolute h-[532px] w-[236px] left-[87px] top-[21px] overflow-hidden pointer-events-none">
    <Image
      alt=""
      aria-hidden
      src="/images/landing/players/yamal.png"
      width={531}
      height={532}
      sizes="640px"
      className="absolute h-full max-w-none top-0"
      style={{ left: "-68.79%", width: "225.05%" }}
    />
  </div>
);

// 4. C 罗（Figma 4227:195141 → star wrapper left=-41 w=468；inner div 602×451 居中 top=-32）
// GlassFloatCard wrapper left=-21 w=383，offset 差 20px → left=-20px
const ronaldoLayer = (
  <div className="absolute h-[602px] w-[451px] left-[-20px] top-[-32px]">
    <Image
      alt=""
      aria-hidden
      src="/images/landing/players/ronaldo.png"
      width={451}
      height={602}
      sizes="502px"
      className="absolute inset-0 size-full max-w-none object-cover pointer-events-none"
    />
  </div>
);

// 5. 贝林厄姆（Figma 5834:3380 → div 543×432 居中偏下，img w=167.59% left=-31.13%）
// sizes 取渲染宽度 432 × 167.59% ≈ 724px
const bellinghamLayer = (
  <div
    className="absolute h-[543px] w-[432px] overflow-hidden pointer-events-none"
    style={{
      left: "calc(50% + 0.5px)",
      top: "calc(50% + 41.5px)",
      transform: "translate(-50%, -50%)",
    }}
  >
    <Image
      alt=""
      aria-hidden
      src="/images/landing/players/bellingham.png"
      width={724}
      height={543}
      sizes="750px"
      className="absolute h-full max-w-none top-0"
      style={{ left: "-31.13%", width: "167.59%" }}
    />
  </div>
);

// 6. 哈兰德（Figma 5832:3353 → div 381×269, left=40）
// 源图 1024×576（横版），fill 拉伸填满竖版容器
// top 从 Figma 的 -38 调整为 34：使图片底边贴齐白色描述框顶部（348px 处）
// sizes 按 2x Retina 取 640px（源图 1024px 足够）
const haalandLayer = (
  <div className="absolute h-[381px] w-[269px] left-[40px] top-[34px]">
    <Image
      alt=""
      aria-hidden
      src="/images/landing/players/haaland.png"
      width={1024}
      height={576}
      sizes="640px"
      className="absolute inset-0 size-full max-w-none pointer-events-none"
      style={{ objectFit: "fill" }}
    />
  </div>
);

// 7. 孙兴慜（Figma 5837:3456 → div 374×347, left=10 top=39, img w=145.38% left=-25.2% top=-1.5%）
// sizes 取渲染宽度 347 × 145.38% ≈ 504px
const sonLayer = (
  <div className="absolute h-[374px] w-[347px] left-[10px] top-[39px] overflow-hidden pointer-events-none">
    <Image
      alt=""
      aria-hidden
      src="/images/landing/players/son.png"
      width={505}
      height={380}
      sizes="640px"
      className="absolute max-w-none"
      style={{ left: "-25.2%", width: "145.38%", top: "-1.5%", height: "101.5%" }}
    />
  </div>
);

// 8. 维尼修斯（Figma 5834:3388 → div 390×398, left=-13 top=-40, img w=141.46% left=-32.46%）
// sizes 取渲染宽度 398 × 141.46% ≈ 563px
const viniciusLayer = (
  <div className="absolute h-[390px] w-[398px] left-[-13px] top-[-40px] overflow-hidden pointer-events-none">
    <Image
      alt=""
      aria-hidden
      src="/images/landing/players/vinicius.png"
      width={563}
      height={390}
      sizes="640px"
      className="absolute h-full max-w-none top-0"
      style={{ left: "-32.46%", width: "141.46%" }}
    />
  </div>
);

// 9. 凯恩（Figma 4227:195143 → div 439×437, left=-27 top=-58, img w=162.39% left=-39.17% top=-7.98%）
// sizes 取渲染宽度 437 × 162.39% ≈ 709px
const kaneLayer = (
  <div className="absolute h-[439px] w-[437px] left-[-27px] top-[-58px] overflow-hidden pointer-events-none">
    <Image
      alt=""
      aria-hidden
      src="/images/landing/players/kane.png"
      width={709}
      height={474}
      sizes="750px"
      className="absolute max-w-none"
      style={{ left: "-39.17%", width: "162.39%", top: "-7.98%", height: "107.98%" }}
    />
  </div>
);

// 10. 佩德里（Figma 5834:3395 → div 645×321, left=8 top=-11, img w=150.07% left=-25.1%）
// sizes 取渲染宽度 321 × 150.07% ≈ 482px
const pedriLayer = (
  <div className="absolute h-[645px] w-[321px] left-[8px] top-[-11px] overflow-hidden pointer-events-none">
    <Image
      alt=""
      aria-hidden
      src="/images/landing/players/pedri.png"
      width={482}
      height={645}
      sizes="502px"
      className="absolute h-full max-w-none top-0"
      style={{ left: "-25.1%", width: "150.07%" }}
    />
  </div>
);

const PLAYERS: ReadonlyArray<Player> = [
  { id: "messi", figmaId: "5129:96443", left: 272, top: 456, imageLayer: messiLayer },
  { id: "mbappe", figmaId: "4227:195140", left: 915, top: 774, imageLayer: mbappeLayer },
  { id: "yamal", figmaId: "5832:3362", left: 120, top: 1143, imageLayer: yamalLayer },
  { id: "ronaldo", figmaId: "4227:195141", left: 692, top: 1472, imageLayer: ronaldoLayer },
  { id: "bellingham", figmaId: "5834:3380", left: 324, top: 2119, imageLayer: bellinghamLayer },
  { id: "haaland", figmaId: "5832:3353", left: 955, top: 2422, imageLayer: haalandLayer },
  { id: "son", figmaId: "5837:3456", left: 421, top: 2869, imageLayer: sonLayer },
  { id: "vinicius", figmaId: "5834:3388", left: 851, top: 3316, imageLayer: viniciusLayer },
  { id: "kane", figmaId: "4227:195143", left: 244, top: 3696, imageLayer: kaneLayer },
  { id: "pedri", figmaId: "5834:3395", left: 758, top: 4112, imageLayer: pedriLayer },
];

export default function MatchesGlassWall() {
  const t = useTranslations("landing.starsNight");
  return (
    <section
      data-section="matches-glass-wall"
      data-figma-node="4227:195136"
      className="relative w-full bg-primary py-[80px]"
    >
      <div className="relative mx-auto h-[4655px] w-[1440px]">
        {/* 中心 sticky 标题块 — Figma 4227:195137，宽 486 高 336
            横向居中：left = (1440 - 486) / 2 = 477 */}
        <div className="pointer-events-none absolute inset-y-0 left-[477px] w-[486px]">
          <div className="pointer-events-auto sticky top-0 flex flex-col items-center gap-[24px] pt-[120px]">
            <h2 className="whitespace-nowrap text-center font-noto-sc text-[48px] font-bold leading-[64px] text-white">
              {t("title")}
            </h2>
            <p className="text-center font-noto-sc text-[16px] font-normal leading-[24px] text-white opacity-70">
              {t("subtitleLine1")}
              <br />
              {t("subtitleLine2")}
            </p>
            {/* Figma 5523:88551 — default 136×56(仅文字) ↔ hover 168×56(文字+8gap+24箭头) */}
            <Link
              href="/markets"
              className="group flex h-[56px] w-[136px] items-center justify-center gap-[8px] overflow-hidden rounded-[12px] bg-white px-[16px] py-[8px] font-noto-sc text-[16px] font-medium leading-[24px] text-[#04060c] transition-[width,background-color] duration-300 ease-out hover:w-[168px] hover:bg-[#f1f1f1]"
              style={{ touchAction: "manipulation" }}
            >
              <span className="whitespace-nowrap">{t("ctaPredictNow")}</span>
              <span
                aria-hidden="true"
                className="flex w-0 shrink-0 items-center justify-center opacity-0 transition-[width,opacity] duration-300 ease-out group-hover:w-[24px] group-hover:opacity-100"
              >
                <ArrowRightIcon size={24} weight="regular" className="shrink-0" />
              </span>
            </Link>
          </div>
        </div>

        {/* 10 张玻璃浮卡，绝对定位 + 各自球员图层 */}
        {PLAYERS.map((p) => (
          <GlassFloatCard
            key={p.figmaId}
            name={t(`players.${p.id}.name`)}
            description={t(`players.${p.id}.description`)}
            className="absolute"
            style={{ left: p.left, top: p.top }}
          >
            {p.imageLayer}
          </GlassFloatCard>
        ))}
      </div>
    </section>
  );
}
