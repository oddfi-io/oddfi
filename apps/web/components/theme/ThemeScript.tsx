// 内联脚本：首屏 paint 前读 localStorage 同步 data-theme，避免 FOUC。
// 默认深色（:root），仅当存储为 "light" 时设置 data-theme="light"。
export default function ThemeScript() {
  const code = `(function(){try{var t=localStorage.getItem('oddfi_theme');if(t==='light')document.documentElement.setAttribute('data-theme','light');}catch(e){}})()`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
