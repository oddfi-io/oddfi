#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SITE_DIR="${SITE_DIR:-${ROOT_DIR}/api-docs-site}"
TEMPLATE="${ROOT_DIR}/scripts/swagger/site-template.html"

mkdir -p "${SITE_DIR}/oddfi-web-api" "${SITE_DIR}/web-api"

# Pages 站点只发布构建后的静态文件；源 swagger.json/yaml 仍由 make swagger 重新生成。
cp "${ROOT_DIR}/oddfi-web-api/docs/swagger/swagger.json" "${SITE_DIR}/oddfi-web-api/swagger.json"
cp "${ROOT_DIR}/oddfi-web-api/docs/swagger/swagger.yaml" "${SITE_DIR}/oddfi-web-api/swagger.yaml"
cp "${ROOT_DIR}/web-api/docs/swagger/swagger.json" "${SITE_DIR}/web-api/swagger.json"
cp "${ROOT_DIR}/web-api/docs/swagger/swagger.yaml" "${SITE_DIR}/web-api/swagger.yaml"

render_swagger_page() {
  local title="$1"
  local spec_url="$2"
  local output="$3"

  sed \
    -e "s#__DOC_TITLE__#${title}#g" \
    -e "s#__SPEC_URL__#${spec_url}#g" \
    "${TEMPLATE}" > "${output}"
}

render_swagger_page "Oddfi Market Web API" "./swagger.json" "${SITE_DIR}/oddfi-web-api/index.html"
render_swagger_page "Oddfi Account Web API" "./swagger.json" "${SITE_DIR}/web-api/index.html"

cat > "${SITE_DIR}/index.html" <<'HTML'
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Oddfi API Docs</title>
    <style>
      :root {
        color-scheme: light;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #1f2937;
        background: #f7f8fa;
      }

      body {
        margin: 0;
      }

      main {
        max-width: 920px;
        margin: 0 auto;
        padding: 48px 24px;
      }

      h1 {
        margin: 0 0 8px;
        font-size: 32px;
        line-height: 1.2;
      }

      p {
        margin: 0 0 28px;
        color: #64748b;
      }

      .links {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 16px;
      }

      a {
        display: block;
        padding: 20px;
        border: 1px solid #d8dee8;
        border-radius: 8px;
        background: #ffffff;
        color: #0f172a;
        text-decoration: none;
      }

      a:hover {
        border-color: #2563eb;
      }

      strong {
        display: block;
        margin-bottom: 8px;
        font-size: 18px;
      }

      span {
        color: #64748b;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Oddfi API Docs</h1>
      <p>main 分支更新后由 GitHub Actions 自动生成和发布。</p>
      <section class="links">
        <a href="./oddfi-web-api/">
          <strong>oddfi-web-api</strong>
          <span>详情页、赛事、盘口、流动池、Banner、token price</span>
        </a>
        <a href="./web-api/">
          <strong>web-api</strong>
          <span>登录、资产、下注、提现、后台订单、market price</span>
        </a>
      </section>
    </main>
  </body>
</html>
HTML

echo "==> api docs site built at ${SITE_DIR}"
