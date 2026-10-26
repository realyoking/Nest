// 简体中文 (zh-Hans) — generated from the zh-Hant text with opencc-js (hk → cn), then mainland wording fixes.
// Used at build time (vite plugin `nest-zh-hans` → STRINGS['zh-Hans']), in the browser as a safety net for inline
// zh-Hant strings (src/lib/hans-dom.js, lazy, zh-Hans only) and on the server for push text (api/_push-lib.js).
import * as OpenCC from 'opencc-js/t2cn';

// Wording: HK / TW terms → mainland usage (applied after character conversion). Longest first.
export const HANS_FIXES = [
  ['登出', '退出登录'], ['登入', '登录'], ['电邮地址', '邮箱地址'], ['电邮', '邮箱'],
  ['帐户', '账户'], ['帐号', '账号'], ['设定', '设置'], ['讯息', '消息'], ['档案', '文件'], ['相片', '照片'],
  ['影片', '视频'], ['预设', '默认'], ['储存', '保存'], ['网路', '网络'], ['支援', '支持'],
  ['搜寻', '搜索'], ['连结', '链接'], ['回覆', '回复'], ['寻日', '昨天'], ['唔该', '谢谢'], ['萤幕', '屏幕'],
  ['列印', '打印'], ['视窗', '窗口'], ['滑鼠', '鼠标'], ['硬碟', '硬盘'], ['伺服器', '服务器'], ['资讯', '信息'],
  ['介面', '界面'], ['预览', '预览'], ['登记', '登记'], ['手提电话', '手机'], ['流动电话', '手机'], ['上载', '上传'],
  ['下载', '下载'], ['应用程式', '应用'], ['外挂', '插件'], ['重新整理', '刷新'], ['使用者', '用户'], ['影相', '拍照'], ['程式码', '代码'], ['程式碼', '代码'],
];

let conv = null;
const converter = () => (conv ||= OpenCC.Converter({ from: 'hk', to: 'cn' }));
export function toHans(s) {
  if (typeof s !== 'string' || !/[\u3400-\u9fff]/.test(s)) return s;
  let out = converter()(s);
  for (const [a, b] of HANS_FIXES) if (out.includes(a)) out = out.split(a).join(b);
  out = out.replace(/(?<![方公])程式/g, '程序'); // 程式 → 程序, but never 方程式 / 公程式 (equations)
  return out;
}
// Deep-convert a strings dictionary (keys untouched; {vars} untouched because they are ASCII).
export function hansDict(v) {
  if (typeof v === 'string') return toHans(v);
  if (Array.isArray(v)) return v.map(hansDict);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, hansDict(x)]));
  return v;
}
