import type { ThemeConfig } from "antd";

export const vercelTheme: ThemeConfig = {
  token: {
    colorPrimary: "#171717",
    colorInfo: "#0070f3",
    colorSuccess: "#0070f3",
    colorWarning: "#f5a623",
    colorError: "#ee0000",

    colorTextBase: "#171717",
    colorTextSecondary: "#4d4d4d",
    colorTextTertiary: "#888888",
    colorTextQuaternary: "#a1a1a1",

    colorBgBase: "#ffffff",
    colorBgLayout: "#fafafa",
    colorBgContainer: "#ffffff",
    colorBgElevated: "#ffffff",

    colorBorder: "#ebebeb",
    colorBorderSecondary: "#f5f5f5",

    fontFamily: "Geist, Inter, system-ui, -apple-system, sans-serif",
    fontFamilyCode: "Geist Mono, ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 14,
    fontSizeSM: 12,
    fontSizeLG: 16,
    fontSizeXL: 20,

    borderRadius: 6,
    borderRadiusLG: 8,
    borderRadiusSM: 4,
    borderRadiusXS: 4,

    padding: 16,
    paddingSM: 12,
    paddingXS: 8,
    paddingLG: 24,
    paddingXL: 32,

    boxShadow: "0 1px 1px #00000005, 0 2px 2px #0000000a",
    boxShadowSecondary: "0 2px 2px #0000000a, 0 8px 8px -8px #0000000a",

    controlHeight: 40,
    controlHeightSM: 32,
    controlHeightLG: 48,

    colorLink: "#0070f3",
    colorLinkHover: "#0070f3",
    colorLinkActive: "#0761d1",
  },
  components: {
    Table: {
      headerBg: "#fafafa",
      headerColor: "#4d4d4d",
      headerSplitColor: "#ebebeb",
      borderColor: "#ebebeb",
      cellPaddingBlock: 12,
      cellPaddingInline: 16,
    },
    Menu: {
      itemBg: "transparent",
      itemSelectedBg: "#fafafa",
      itemSelectedColor: "#171717",
      itemActiveBg: "#fafafa",
      itemBorderRadius: 6,
    },
    Button: {
      borderRadius: 6,
      controlHeight: 32,
      defaultBg: "#ffffff",
      defaultBorderColor: "#ebebeb",
    },
    Card: {
      borderRadiusLG: 8,
    },
    Input: {
      borderRadius: 6,
      controlHeight: 40,
    },
    Layout: {
      headerBg: "#ffffff",
      headerHeight: 64,
      headerPadding: "12px 24px",
      siderBg: "#fafafa",
      bodyBg: "#fafafa",
    },
    Tabs: {
      itemColor: "#4d4d4d",
      itemSelectedColor: "#171717",
      inkBarColor: "#171717",
    },
  },
};
