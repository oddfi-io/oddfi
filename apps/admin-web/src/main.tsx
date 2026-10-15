import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

const JWT_KEY = "oddfi_admin_jwt";

// Lark OAuth fragment 模式：落地根路径 /#token=<JWT> 或 /#error=<CODE>。
// 必须在 mount <App/> 之前同步执行，避免 React Router 先吃掉路由。
// 契约：00-architecture.md §3。
function bootstrapAuthFromHash() {
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return;
  const params = new URLSearchParams(hash);
  const token = params.get("token");
  const error = params.get("error");
  if (token) {
    localStorage.setItem(JWT_KEY, token);
    // 抹掉 #token，防书签/分享泄漏 JWT。
    window.history.replaceState(null, "", window.location.pathname);
  } else if (error) {
    // ⚠️ error 来自 URL fragment，用户可任意构造。必须白名单过滤后再存，
    // /login 页只能按 code 查表渲染纯文本，绝不把原值插入 DOM/href（防反射 XSS）。
    const KNOWN = new Set([
      "NOT_ADMIN",
      "LARK_STATE_MISMATCH",
      "LARK_EXCHANGE_FAILED",
      "LARK_USER_INFO_FAILED",
    ]);
    sessionStorage.setItem("lark_login_error", KNOWN.has(error) ? error : "UNKNOWN");
    window.history.replaceState(null, "", "/login");
  }
}

bootstrapAuthFromHash();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
