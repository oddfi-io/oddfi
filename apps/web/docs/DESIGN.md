# OddFi DMD v2

> DMD means design markdown in this project. This document follows the section structure used by `VoltAgent/awesome-design-md`, and is grounded in two sources: the current public OddFi website behavior and the accessible Figma file `oddfi UI UX`.

Source context:

- Website target requested: `https://www.oddfi.io/zh/markets`
- Current live behavior verified on May 15, 2026: `/zh/markets` redirects into the new World Cup campaign/home flow rather than exposing the old dedicated markets screen directly.
- Figma file: `oddfi UI UX`
- Figma file key: `6WH0v3q8t3rImMXpt7uGXs`
- Figma pages used:
  - `01-首页`
  - `02-市场页&Portfolio页`
  - `图标库&组件库`
- This DMD therefore covers both halves of the current OddFi product language:
  - the cinematic campaign/landing system now visible on the live site
  - the dark trading interface system still defined in Figma market-detail screens and components

## 1. Visual Theme & Atmosphere

OddFi is not a generic sportsbook and not a generic DeFi dashboard. Its visual system blends two distinct but related modes:

- **Campaign mode:** cinematic, event-driven, hype-controlled, built around the 2026 World Cup, AI-native positioning, and premium launch energy.
- **Trading mode:** dark, compact, information-rich, built for scanning odds, positions, liquidity, charts, and bet actions quickly.

The overall brand should feel:

- premium, dark, and futuristic
- football-native rather than casino-native
- DeFi-capable without looking like a protocol admin panel
- AI-forward without falling into neon sci-fi cliches
- energetic at the top level, disciplined at the workflow level

### Core mood split

- **Landing pages** should feel bold, widescreen, atmospheric, and collectible.
- **Markets and portfolio pages** should feel fast, precise, stable, and dense.

### Signature characteristics

- Near-black shell with layered charcoal surfaces.
- Mint-teal as the primary brand signal.
- Orange, red, green, and yellow used as semantic or sports-energy accents.
- Strong display typography in hero and section headings.
- Compact operational typography in product surfaces.
- Blurred glass, translucent chrome, and soft glow on landing surfaces.
- Flat, tight, bordered panels inside market and modal workflows.
- Football iconography, team badges, timeline patterns, and live-status markers.
- Reusable component logic across desktop and mobile rather than one-off art direction.

OddFi should feel like a prediction market rebuilt as a premium sports-finance product: campaign-led on the outside, execution-led on the inside.

## 2. Color Palette & Roles

The current live CSS exposes a stable token system. Use those values as the canonical base.

### Core dark surfaces

- **Primary Background** (`#04060C`): main app/page background.
- **Secondary Background** (`#111114`): panels, cards, modal surfaces, tab tracks.
- **Tertiary Background** (`#212124`): raised elements, hover fills, dropdowns.
- **Divider / Strong Border** (`#37393A`): major outlines, separators, control borders.
- **Soft Dark Textural Layer** (`rgba(4, 6, 12, 0.7)`): modal mask and overlay veil.

### Text

- **Primary Text** (`#FFFFFF`): hero lines, key values, active nav, primary labels.
- **Secondary Text** (`#8B8D93`): metadata, secondary labels, support copy.
- **Tertiary Text** (`#5C5D61`): disabled, tertiary support copy, low-priority annotation.
- **Static Black on Bright Buttons** (`#04060C`): text on mint and white filled CTAs.

### Brand accents

- **Brand Mint** (`#28F4D2`): primary CTA fill, active links, selected states, brand emphasis.
- **Brand Mint Hover** (`#6FF8E1`): hover text/state for mint-forward actions.
- **Brand Mint Press** (`#9CFAEA`): pressed/highlight variation in light contexts.
- **Brand Dark Mint** (`#1CAD95`): light-theme or secondary emphasis version.

### Semantic accents

- **Orange** (`#ED7442`): sports energy, feature highlights, cautionary emphasis, section accents.
- **Green** (`#2DB270`): positive status, success, confirmed, profitable direction.
- **Red** (`#ED4C52`): destructive, sell/downside, urgent error, negative state.
- **Yellow** (`#F1C409`): warning, rewards, spotlight metrics, emphasis markers.
- **Blue Brand Family** (`#5972FE`, `#304FFE`): secondary branded technology accents, less central than mint.

### Functional fills

- **Input Fill 1** (`#111114`): default dark input.
- **Input Fill 2** (`#212124`): alternate or focused dark input background.
- **Card Fill 1** (`#111114`): dark card surface.
- **Card Fill 2** (`#212124`): raised card or hover surface.
- **Dropdown Fill** (`#212124`): menus, lists, floating selectors.
- **Tooltip Dark** (`#212124`): web tooltip surface.
- **Tooltip Light** (`#F1F1F1`): app-style inverse tooltip surface.

### Tag and status fills

- **Mint Transparent Tag** (`rgba(40, 244, 210, 0.15)`)
- **Green Transparent Tag** (`rgba(45, 178, 112, 0.1)`)
- **Red Transparent Tag** (`rgba(237, 76, 82, 0.1)`)
- **Gray Transparent Tag** (`rgba(255, 255, 255, 0.08)`)
- **Orange Transparent Tag** (`rgba(237, 116, 66, 0.2)`)
- **Yellow Transparent Tag** (`rgba(244, 208, 58, 0.1)`)

### Usage rules

- Keep the interface predominantly dark; mint is a signal, not a background theme.
- In landing pages, mint and orange can be used to create momentum, but black should still dominate.
- In trading views, use mint for active choice, CTA, selected market, and profitable/affirmative state.
- Use red only when the user should interpret risk, error, loss, or destructive action.
- Yellow is for spotlight and warning, not for core navigation.
- Blue should support AI/product-tech subthemes, not replace mint as the primary identity.

## 3. Typography Rules

OddFi uses different type voices for different levels of communication.

### Font roles

- **Brand / navigation display:** `Orbitron`
- **General UI sans:** `Poppins`
- **Extended editorial display accent:** `Pilat Extended`
- **Fallback UI stack:** `Inter`, `PingFang SC`, `Noto Sans SC`, `Microsoft YaHei`, `system-ui`, `sans-serif`

### Recommended stack by use case

```css
--font-brand: "Orbitron", "Orbitron Fallback", sans-serif;
--font-ui:
  "Poppins", "Poppins Fallback", "Inter", "PingFang SC", "Noto Sans SC", system-ui, sans-serif;
--font-display: "Pilat Extended", "Orbitron", "Inter", sans-serif;
```

### Hierarchy

- **Hero eyebrow / short signal line:** 56-64px, bold, uppercase or tightly controlled short phrase.
- **Hero headline:** 64-136px visual block in Figma; should read monumental, not paragraph-like.
- **Section heading:** 48-64px desktop.
- **Product heading:** 24-32px.
- **Navigation label:** 15-16px with stronger weight.
- **Body / support text:** 16-18px for landing copy.
- **Operational label:** 12-18px in market and modal surfaces.
- **Metric / amount:** 36-64px depending on module importance.
- **Microcopy / metadata:** 12-13px.

### Numeric behavior

- Use tabular numerals for balances, odds, timestamps, prices, and volumes.
- Keep decimal precision visually calm; emphasize whole-number structure first.
- In charts and transaction panels, align numbers consistently to reduce scan cost.

### Text behavior

- Hero and brand copy can be bold and declarative.
- Product and trading copy should be short, direct, and operational.
- Chinese and English can coexist, but English terms like `Market`, `Portfolio`, `Cash`, `Credits`, `Deposit`, `Confirm`, `Over`, `Under`, and `AI Agent` are part of the product language.
- Avoid verbose educational copy inside trading flows.

## 4. Component Stylings

### Header

Used in both live site and Figma.

- Desktop height: `64px`
- Left: OddFi logo + main navigation
- Right: portfolio/cash/credits summaries, CTA, avatar, or connect state
- Background in live site: translucent dark glass over page content
- Visual treatment:
  - dark blur layer
  - subtle border or divider
  - bright active mint state
  - otherwise white text at reduced emphasis

Header nav items currently include:

- `Home`
- `Market` or `Markets`
- `Pools` / `Liquidity`
- `Stake`
- `Lend`
- `Swap`
- `Referral`
- `Presale`
- optional `AI Agent`

### Primary buttons

Component library confirms these variants:

- `primary`
- `secondary`
- `tertiary`
- sizes `48`, `40`, `32`

Rules:

- **Primary:** mint fill, dark text, strong weight.
- **Secondary:** translucent mint-tinted or dark bordered surface.
- **Tertiary:** dark neutral surface, utility action.
- Standard radius should follow the token family: `8px`, `12px`, `16px` depending on prominence.
- Common heights:
  - `56px` on landing CTA
  - `48px` on form and modal actions
  - `40px` and `32px` for compact utilities

### Bet button

Dedicated betting button exists in the component library.

- Compact pill-like or rounded action.
- Should read as a direct action chip rather than a generic admin button.
- Hover state must feel sharper and brighter than default.

### Inputs and selects

Component library includes:

- standard text input
- icon input
- select
- dropdown list

Rules:

- Dark fill with strong contrast placeholder and value text.
- Height variants `48px` and `40px`.
- Border/divider line should stay subtle until active/focused.
- Use icon-leading inputs sparingly for search, amount, address, token, or wallet flows.

### Prediction cards

Homepage prediction cards are large, visual, and carousel-like.

- Approx card width: `450px`
- Tall visual crop with strong football/event imagery
- Short title plus direct CTA such as `Predict Now`
- Should feel collectible and premium, not like flat news cards

### Star cards / player cards

These are narrative football personality cards.

- Use portrait-led composition
- Overlay short player title and one-line positioning copy
- Keep spacing wide and theatrical

### KPI block

Figma includes large metric sections like cumulative betting volume.

- Giant number first
- Short label second
- Supporting stat strip below
- Use contrast and scale rather than decorative charts for the main figure

### USP cards

The current system includes at least six value proposition cards.

Likely topics, aligned with live site content:

- Zero Slippage
- Position Lending
- Stake to Earn
- Market Making for All
- AI Agent Trading
- No KYC

Rules:

- Rich visual crop or textured illustration
- One concept per card
- Title must be short and confident
- Supporting line no more than 1-2 sentences

### AI Agent module

Distinct section in both Figma and website content.

- Centered section headline
- Three explanatory cards
- Optional `Coming Soon` or launch-state badge
- Use blue/mint/tech-accent language sparingly

### FAQ

Accordion system exists in Figma with:

- collapsed default
- collapsed hover
- expanded default
- expanded hover

Rules:

- Row height around `74px` collapsed
- Expanded state should add content without losing alignment
- Hover should be visible but restrained

### Trading page layout modules

Figma market-detail pages show these repeatable modules:

- left sports/category sidebar
- event summary rail
- odds selection groups
- chart card
- larger detail/background panel
- bet panel on the right
- portfolio/cash/credits strip in the header

### Sidebar

- Width around `184-200px`
- Nested menu states for category and subcategory
- Supports collapsed and expanded behavior
- Use icons plus concise labels like `World Cup`, `UEFA`, and market grouping labels

### Odds group / market buttons

Observed forms:

- two-way choice rows
- three-slot over/under layouts
- team-name + line + odds rows

Rules:

- Keep tap targets tight but readable
- Use selected-state fill rather than only text color
- Align labels and price/line values cleanly

### Chart card

The market-detail Figma includes a probability chart module with:

- right-side percentage axis `0%` to `100%`
- bottom timestamps
- multiple line series
- compact legend/header row

Rules:

- Dark panel background
- Thin grid lines
- high-contrast line colors
- chart should feel analytical, not decorative

### Bet panel

Right column trading/betting panel is a major interaction surface.

- Width around `440px`
- Includes amount, summary, transaction breakdown, and confirm actions
- Must support deposit, confirm, receive, and related modal states

### Wallet, deposit, receive, and transaction modals

Figma defines a complete modal family:

- sign-up modal
- sign-message modal
- deposit method selection
- asset selection
- amount entry
- transaction confirmation
- receive address / QR
- success and pending status panels

Rules:

- Modal width commonly `440px`
- Strong centered title block
- Generous padding inside, but compact action stack
- Use dark overlay mask
- Status icons should be large, centered, and semantically clear

## 5. Layout Principles

### Global desktop philosophy

OddFi uses two layout modes:

- **Campaign layout:** full-width storytelling sections with strong vertical rhythm.
- **Trading layout:** fixed-shell application layout with explicit columns.

### Landing page structure

The homepage Figma is organized into clear chapter blocks:

1. Header
2. Hero
3. Prediction card carousel
4. Player/star narrative section
5. Trading/product capability showcase
6. KPI/stat section
7. ODD token section
8. USP section
9. AI Agent section
10. Roadmap
11. FAQ
12. Repeat CTA
13. Partners
14. Footer

Rules:

- Use dramatic full-width panels, but keep the internal content width disciplined around `1200px`.
- Use large vertical spacing between landing chapters.
- Let imagery drive the outer silhouette, while text blocks remain aligned and calm.

### Trading page structure

The Figma market-detail page reads as a 4-column logic split:

1. top navigation/header
2. left sidebar
3. center-left event/market list rail
4. center chart + detail panel
5. right bet panel

Practical desktop proportions:

- Sidebar: `184-200px`
- Secondary list rail: `284px`
- Main analysis/content column: `420px`
- Bet column: `440px`

### Spacing

- Use `8px` spacing logic as the base grid.
- Common radii tokens:
  - `4px`
  - `8px`
  - `12px`
  - `16px`
  - `24px`
- Landing page should use larger section spacing than the product surface.
- Trading pages should prioritize tight scan rhythm over theatrical whitespace.

## 6. Depth & Elevation

Depth in OddFi comes from blur, opacity, and surface layering more than from heavy shadows.

### Landing mode elevation

- translucent dark header over background art
- soft glows and atmospheric image treatment
- blurred glass cards or masks when needed
- decorative depth should feel premium, not noisy

### Trading mode elevation

- flat stacked dark surfaces
- crisp borders and dividers
- small state-driven lifts rather than shadows
- overlays and modals use a stronger mask plus centered card

### Recommended elevation system

- **Level 0:** page background `#04060C`
- **Level 1:** base panel `#111114`
- **Level 2:** raised panel / hover `#212124`
- **Level 3:** active or selected state with mint border/fill cue
- **Level 4:** modal or floating layer above masked page

### Shadows and blur

- Blur is appropriate for live-site header chrome and premium overlays.
- Use shadows lightly; dark UI should not become muddy.
- Modal prominence should come from mask contrast first, shadow second.

## 7. Do's and Don'ts

### Do

- Combine sports atmosphere with disciplined fintech/product structure.
- Keep mint as the primary brand action color.
- Use Orbitron for brand-facing navigation and signature moments.
- Use Poppins or a clean sans for product UI and long-form reading.
- Preserve the difference between campaign sections and execution screens.
- Reuse the existing component families from the Figma library.
- Keep trading flows compact and explicit.
- Use semantic iconography for wallet, status, AI, live, and transaction actions.
- Treat modal flows as first-class product surfaces, not throwaway dialogs.

### Don't

- Do not turn the trading product into a generic purple cyberpunk dashboard.
- Do not overuse gradients in product surfaces.
- Do not make mint the background of entire large sections.
- Do not use giant soft cards everywhere in markets pages.
- Do not mix too many accent colors in one module.
- Do not make campaign typography and trading typography feel identical.
- Do not flatten all pages into one same-looking dark SaaS style.
- Do not use light gray text on medium-gray dark surfaces with weak contrast.
- Do not treat sports visuals as random decoration; they should support event anticipation and product relevance.

## 8. Responsive Behavior

### Desktop

- Preserve the full structure of the landing page chapters.
- Preserve multi-column trading view.
- Keep right bet panel visible on large screens.
- Keep nav readable and not overly compressed.

### Tablet

- Landing sections can stack more tightly, but the visual hierarchy must remain theatrical.
- Trading layout should collapse secondary columns before collapsing the bet panel.
- Sidebar can become a compact drawer or icon-first rail.

### Mobile

- Header becomes condensed.
- Market columns collapse into a single stacked flow.
- Bet panel becomes sticky bottom CTA or dedicated sheet.
- Prediction cards should become horizontal or vertically stacked media cards.
- Modals should preserve the same hierarchy but fit a narrow width cleanly.

### Responsive priorities

- First preserve brand recognition.
- Then preserve betting clarity.
- Then preserve comparison/scanning behavior.
- Drop decorative side-by-side complexity before dropping key transactional information.

## 9. Agent Prompt Guide

Use this when generating or editing OddFi UI:

> Build an OddFi interface that combines a cinematic World Cup campaign surface with a dark, premium trading product. Use a near-black background, mint primary actions, Orbitron brand typography, Poppins-style operational UI, football-led visual storytelling, and compact DeFi betting workflows. Landing sections should feel bold and editorial; market and portfolio screens should feel dense, precise, and execution-focused.

For landing pages, include:

- glassy dark header with OddFi brand
- large hero with short AI-native signal line
- strong football-event imagery
- prediction cards
- star/player storytelling blocks
- product capability showcase
- KPI/stat section
- ODD token section
- USP cards
- AI Agent section
- roadmap, FAQ, CTA, partners, footer

For trading pages, include:

- dark application shell
- left sidebar for leagues/categories
- center event and market modules
- chart card with percentage axis and timestamps
- right bet panel
- compact nav with portfolio/cash/credits
- modal flows for deposit/receive/confirm when relevant

Quick token reference:

```css
/* ⚠️ DEVELOPER / AI WARNING
   The --oddfi-* variable names below DO NOT exist in the codebase.
   They are design documentation only.
   In code, use the Tailwind class mapping table below instead.
   Never use raw hex values from this file directly in JSX or CSS.
*/
:root {
  --oddfi-bg: #04060c;
  --oddfi-surface-1: #111114;
  --oddfi-surface-2: #212124;
  --oddfi-border: #37393a;

  --oddfi-text: #ffffff;
  --oddfi-text-secondary: #8b8d93;
  --oddfi-text-tertiary: #5c5d61;
  --oddfi-text-on-accent: #04060c;

  --oddfi-mint: #28f4d2;
  --oddfi-mint-hover: #6ff8e1;
  --oddfi-mint-dark: #1cad95;
  --oddfi-orange: #ed7442;
  --oddfi-green: #2db270;
  --oddfi-red: #ed4c52;
  --oddfi-yellow: #f1c409;
  --oddfi-blue: #5972fe;

  --oddfi-radius-4: 4px;
  --oddfi-radius-8: 8px;
  --oddfi-radius-12: 12px;
  --oddfi-radius-16: 16px;
  --oddfi-radius-24: 24px;
}
```

### Frontend Implementation: Tailwind Token Mapping

When implementing UI from this design document, **never use raw hex values or `--oddfi-*` variable names**. Always use the Tailwind class mapped below. The hex values here match the actual CSS variables in `app/design-tokens.css`.

#### Surfaces & Backgrounds

| Role                       | Hex                | Tailwind Class        |
| -------------------------- | ------------------ | --------------------- |
| Primary Background         | `#04060C`          | `bg-primary`          |
| Secondary Background       | `#111114`          | `bg-secondary`        |
| Tertiary Background        | `#212124`          | `bg-tertiary`         |
| Soft Dark Overlay          | `rgba(4,6,12,0.7)` | `bg-fill-mask`        |
| Input Fill (default)       | `#111114`          | `bg-fill-input`       |
| Input Fill (modal/focused) | `#212124`          | `bg-fill-input-modal` |
| Card Fill (default)        | `#111114`          | `bg-fill-card1`       |
| Card Fill (raised/hover)   | `#212124`          | `bg-fill-card2`       |
| Dropdown Fill              | `#212124`          | `bg-fill-dropdown`    |
| Tooltip (dark/web)         | `#212124`          | `bg-fill-tooltip-web` |
| Tooltip (light/app)        | `#F1F1F1`          | `bg-fill-tooltip-app` |

#### Text Colors

| Role                          | Hex       | Tailwind Class       |
| ----------------------------- | --------- | -------------------- |
| Primary Text                  | `#FFFFFF` | `text-primary`       |
| Secondary Text                | `#8B8D93` | `text-secondary`     |
| Tertiary Text                 | `#5C5D61` | `text-tertiary`      |
| Static White                  | `#FFFFFF` | `text-static-white`  |
| Static Black (on bright CTAs) | `#04060C` | `text-static-black`  |
| Brand Mint (default)          | `#28F4D2` | `text-brand-default` |
| Brand Mint (hover)            | `#6FF8E1` | `text-brand-hover`   |
| Brand Mint (press)            | `#9CFAEA` | `text-brand-press`   |
| Orange (energy/accent)        | `#ED7442` | `text-orange`        |
| Green (positive/success)      | `#2DB270` | `text-green`         |
| Red (error/risk/negative)     | `#ED4C52` | `text-red`           |

#### Borders & Dividers

| Role                    | Hex       | Tailwind Class                          |
| ----------------------- | --------- | --------------------------------------- |
| Divider / Strong Border | `#37393A` | `border-divider`                        |
| Default Border          | —         | `border` (uses `--line-border-primary`) |
| Secondary Border        | —         | `border-secondary`                      |
| Hover Border            | —         | `border-dt-hover`                       |
| Error Border            | —         | `border-dt-error`                       |

#### Button Fills

| Role                    | Tailwind Class           |
| ----------------------- | ------------------------ |
| Primary CTA (mint fill) | `bg-btn-primary`         |
| Primary CTA (hover)     | `bg-btn-primary-hover`   |
| Primary CTA (disabled)  | `bg-btn-primary-disable` |
| Secondary Button        | `bg-btn-secondary`       |
| Tertiary Button         | `bg-btn-tertiary`        |
| Red/Destructive Button  | `bg-btn-red`             |
| Green/Confirm Button    | `bg-btn-green`           |

#### Semantic / Functional Colors

| Role                       | Hex       | Tailwind Class                       |
| -------------------------- | --------- | ------------------------------------ |
| Brand Mint (multi-context) | `#28F4D2` | `bg-fn-brand` / `text-brand-default` |
| Green (success/profit)     | `#2DB270` | `bg-fn-green` / `text-green`         |
| Red (loss/error)           | `#ED4C52` | `bg-fn-red` / `text-red`             |
| Yellow (spotlight/warning) | `#F1C409` | `bg-fn-yellow`                       |
| Orange (energy/caution)    | `#ED7442` | `bg-fn-orange` / `text-orange`       |

#### Tag Fills (Transparent)

| Role       | Value                    | Tailwind Class  |
| ---------- | ------------------------ | --------------- |
| Mint Tag   | `rgba(40,244,210,0.15)`  | `bg-tag-brand`  |
| Green Tag  | `rgba(45,178,112,0.1)`   | `bg-tag-green`  |
| Red Tag    | `rgba(237,76,82,0.1)`    | `bg-tag-red`    |
| Gray Tag   | `rgba(255,255,255,0.08)` | `bg-tag-gray`   |
| Orange Tag | `rgba(237,116,66,0.2)`   | `bg-tag-orange` |
| Yellow Tag | `rgba(244,208,58,0.1)`   | `bg-tag-yellow` |

> **Context-dependent classes:** Brand Mint appears as `text-brand-default` (text), `bg-btn-primary` (button fill), `bg-fn-brand` (semantic indicator). Choose based on the element's role. Same applies to Green and Red. When in doubt, prefer `fn-*` for semantic meaning and `btn-*` for interactive controls.

Use these guardrails when uncertain:

- Landing page decision: choose bolder imagery, larger type, and more atmosphere.
- Trading page decision: choose denser layouts, clearer state, and faster scanability.
- Brand decision: mint wins over blue.
- Product decision: clarity wins over decoration.
