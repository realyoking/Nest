// Run 18 — branded transactional emails (sent through Resend by api/_email.js). Email-client safe: table layout, inline
// styles only, no web fonts required (Nunito / Noto Sans TC when the client has them), hosted PNG logo on nesty.cyou,
// light-only colour scheme, hidden preheader, and a plain-text part. Design = work/email-mock/verify.html (approved):
// white rounded card on #f2f2f0, Nest 巢 logo, big headline, 6 black rounded digit tiles, outline pill button, anti-phishing
// note, footer nesty.cyou · privacy · terms. Languages: zh-Hant (HK 書面語) / zh-Hans / en (anything else → en).
import { SITE, SITE_HOST } from '../src/site.js';
export const EMAIL_LOGO = `${SITE}/email/nest-logo.png`;
export const emailLang = (l) => (l === 'zh-Hant' || l === 'zh-Hans' ? l : 'en');
const SEG = { en: 'en', 'zh-Hant': 'zh-hant', 'zh-Hans': 'zh-hans' };
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const COPY = {
  'zh-Hant': {
    brand: 'Nest 巢', tagline: '一家人的 AI 小助手', privacy: '私隱政策', terms: '條款', others: [['en', 'English'], ['zh-Hans', '简体中文']],
    verify: {
      subject: (c) => `你的 Nest 驗證碼：${c}`, pre: (c) => `驗證碼 ${c}，10 分鐘內有效。`,
      h1: '確認你的電郵地址', lead: '在 Nest 輸入以下 6 位數驗證碼，即可完成註冊。', meta: '驗證碼 10 分鐘內有效 · 只可使用一次',
      btn: '或直接在瀏覽器開啟 Nest →',
      note: '如果你沒有申請註冊 Nest，可以忽略這封郵件，你的帳戶不會有任何變更。請勿把驗證碼告訴任何人，Nest 職員絕不會向你索取。',
      textCode: '你的驗證碼',
    },
    reset: {
      subject: () => '重設你的 Nest 密碼', pre: () => '按下連結設定新密碼，連結 1 小時內有效。',
      h1: '重設密碼', lead: (e) => `我們收到重設 ${e} 的 Nest 密碼的要求。按下方按鈕即可設定新密碼。`, meta: '連結 1 小時內有效 · 只可使用一次',
      btn: '設定新密碼 →', fallback: '如按鈕無法使用，請把以下連結複製到瀏覽器：',
      note: '如果你沒有要求重設密碼，可以忽略這封郵件，你的密碼不會改變。Nest 職員絕不會向你索取密碼。',
    },
  },
  'zh-Hans': {
    brand: 'Nest 巢', tagline: '一家人的 AI 小助手', privacy: '隐私政策', terms: '条款', others: [['en', 'English'], ['zh-Hant', '繁體中文']],
    verify: {
      subject: (c) => `你的 Nest 验证码：${c}`, pre: (c) => `验证码 ${c}，10 分钟内有效。`,
      h1: '确认你的邮箱地址', lead: '在 Nest 输入以下 6 位数验证码，即可完成注册。', meta: '验证码 10 分钟内有效 · 只能使用一次',
      btn: '或直接在浏览器打开 Nest →',
      note: '如果你没有申请注册 Nest，可以忽略这封邮件，你的账户不会有任何变更。请勿把验证码告诉任何人，Nest 工作人员绝不会向你索取。',
      textCode: '你的验证码',
    },
    reset: {
      subject: () => '重设你的 Nest 密码', pre: () => '点击链接设置新密码，链接 1 小时内有效。',
      h1: '重设密码', lead: (e) => `我们收到重设 ${e} 的 Nest 密码的请求。点击下方按钮即可设置新密码。`, meta: '链接 1 小时内有效 · 只能使用一次',
      btn: '设置新密码 →', fallback: '如按钮无法使用，请把以下链接复制到浏览器：',
      note: '如果你没有要求重设密码，可以忽略这封邮件，你的密码不会改变。Nest 工作人员绝不会向你索取密码。',
    },
  },
  en: {
    brand: 'Nest', tagline: 'Your family’s AI helper', privacy: 'Privacy', terms: 'Terms', others: [['zh-Hant', '繁體中文'], ['zh-Hans', '简体中文']],
    verify: {
      subject: (c) => `Your Nest code: ${c}`, pre: (c) => `Your code is ${c}. It’s valid for 10 minutes.`,
      h1: 'Confirm your email', lead: 'Enter this 6-digit code in Nest to finish signing up.', meta: 'Valid for 10 minutes · Can only be used once',
      btn: 'Or open Nest in your browser →',
      note: 'If you didn’t sign up for Nest, you can ignore this email — nothing will change on your account. Never share this code with anyone. Nest staff will never ask for it.',
      textCode: 'Your code',
    },
    reset: {
      subject: () => 'Reset your Nest password', pre: () => 'Use the link to choose a new password. It’s valid for 1 hour.',
      h1: 'Reset your password', lead: (e) => `We got a request to reset the Nest password for ${e}. Use the button below to choose a new one.`, meta: 'Link valid for 1 hour · Can only be used once',
      btn: 'Choose a new password →', fallback: 'If the button doesn’t work, copy this link into your browser:',
      note: 'If you didn’t ask to reset your password, you can ignore this email — your password won’t change. Nest staff will never ask for your password.',
    },
  },
};

const FONT = `Nunito,'Noto Sans TC','Noto Sans SC',-apple-system,BlinkMacSystemFont,'PingFang TC','PingFang SC','Microsoft JhengHei','Microsoft YaHei','Segoe UI',Helvetica,Arial,sans-serif`;
const legal = (lang, kind) => (lang === 'en' ? `${SITE}/${kind}` : `${SITE}/${SEG[lang]}/${kind}`);

function frame({ lang, title, preheader, body }) {
  const C = COPY[lang];
  const html = lang === 'zh-Hant' ? 'zh-Hant-HK' : lang === 'zh-Hans' ? 'zh-Hans' : 'en';
  const others = C.others.map(([l, n]) => `<a href="${SITE}/${SEG[l]}/" style="color:#999999;text-decoration:none">${n}</a>`).join(' &nbsp;·&nbsp; ');
  return `<!doctype html>
<html lang="${html}" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<meta name="x-apple-disable-message-reformatting">
<title>${esc(title)}</title>
<style>
@media (max-width:520px){.nest-card{padding:32px 22px 28px !important;border-radius:22px !important}.nest-h1{font-size:27px !important}.nest-tile{font-size:26px !important;height:56px !important;border-radius:12px !important}}
a{color:#111111}
</style>
</head>
<body style="margin:0;padding:0;background:#f2f2f0;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f2f2f0;font-size:1px;line-height:1px">${esc(preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f2f0">
<tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
<tr><td class="nest-card" style="background:#ffffff;border:1px solid #e6e6e3;border-radius:28px;padding:44px 44px 36px;font-family:${FONT};color:#111111">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="vertical-align:middle"><img src="${EMAIL_LOGO}" width="38" height="38" alt="Nest" style="display:block;width:38px;height:38px;border-radius:10px;border:0"></td>
<td style="vertical-align:middle;padding-left:10px;font-family:${FONT};font-weight:900;font-size:22px;color:#111111;letter-spacing:-.3px">${esc(C.brand)}</td>
</tr></table>
${body}
</td></tr>
<tr><td align="center" style="padding:20px 10px 8px;font-family:${FONT};font-size:12px;line-height:1.8;color:#999999">
${esc(C.brand)} &nbsp;·&nbsp; ${esc(C.tagline)}<br>
<a href="${SITE}/" style="color:#999999;text-decoration:none">${SITE_HOST}</a> &nbsp;·&nbsp; <a href="${legal(lang, 'privacy')}" style="color:#999999;text-decoration:none">${esc(C.privacy)}</a> &nbsp;·&nbsp; <a href="${legal(lang, 'terms')}" style="color:#999999;text-decoration:none">${esc(C.terms)}</a><br>
${others}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
const h1 = (t) => `<h1 class="nest-h1" style="margin:34px 0 10px;font-family:${FONT};font-weight:900;font-size:32px;line-height:1.15;letter-spacing:-.5px;color:#111111">${esc(t)}</h1>`;
const p = (t, extra = '') => `<p style="margin:0 0 6px;font-family:${FONT};font-size:16px;line-height:1.6;color:#444444;${extra}">${t}</p>`;
const note = (t) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid #eeeeee;padding-top:18px;margin-top:30px;font-family:${FONT};font-size:13px;line-height:1.6;color:#888888">${esc(t)}</td></tr></table>`;
const pill = (href, label, solid = false) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="border-radius:999px;border:2px solid #111111;background:${solid ? '#111111' : '#ffffff'}"><a href="${esc(href)}" style="display:block;padding:15px 18px;font-family:${FONT};font-weight:800;font-size:16px;line-height:1.3;color:${solid ? '#ffffff' : '#111111'};text-decoration:none;border-radius:999px">${esc(label)}</a></td></tr></table>`;

function tiles(code) {
  const cells = String(code).split('').map((d, i) => `${i ? '<td width="2%" style="font-size:0;line-height:0">&nbsp;</td>' : ''}<td class="nest-tile" width="15%" align="center" valign="middle" height="64" style="height:64px;background:#111111;border-radius:16px;font-family:${FONT};font-weight:900;font-size:32px;line-height:1;color:#ffffff;mso-line-height-rule:exactly">${esc(d)}</td>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 12px;table-layout:fixed" aria-label="${esc(String(code))}"><tr>${cells}</tr></table>`;
}

// 6-digit verification code email. → { subject, html, text }
export function verifyEmail({ code, lang: l }) {
  const lang = emailLang(l); const C = COPY[lang]; const V = C.verify;
  const appUrl = `${SITE}/app?verify=1`;
  const body = `${h1(V.h1)}${p(esc(V.lead))}${tiles(code)}
<p style="margin:0 0 26px;font-family:${FONT};font-size:13px;color:#888888">${esc(V.meta)}</p>
${pill(appUrl, V.btn)}
<div style="height:30px;line-height:30px;font-size:0">&nbsp;</div>
${note(V.note)}`;
  const text = `${V.h1}\n\n${V.lead}\n\n${V.textCode}: ${code}\n${V.meta}\n\n${appUrl}\n\n${V.note}\n\n— ${C.brand} · ${SITE}`;
  return { subject: V.subject(code), html: frame({ lang, title: V.subject(code), preheader: V.pre(code), body }), text };
}

// Password reset email (link to https://nesty.cyou/auth/action). → { subject, html, text }
export function resetEmail({ link, email, lang: l }) {
  const lang = emailLang(l); const C = COPY[lang]; const R = C.reset;
  const body = `${h1(R.h1)}${p(esc(R.lead(email)))}
<div style="height:24px;line-height:24px;font-size:0">&nbsp;</div>
${pill(link, R.btn, true)}
<p style="margin:12px 0 22px;font-family:${FONT};font-size:13px;color:#888888;text-align:center">${esc(R.meta)}</p>
<p style="margin:0 0 6px;font-family:${FONT};font-size:12px;line-height:1.6;color:#888888">${esc(R.fallback)}<br><a href="${esc(link)}" style="color:#555555;word-break:break-all">${esc(link)}</a></p>
<div style="height:24px;line-height:24px;font-size:0">&nbsp;</div>
${note(R.note)}`;
  const text = `${R.h1}\n\n${R.lead(email)}\n\n${link}\n${R.meta}\n\n${R.note}\n\n— ${C.brand} · ${SITE}`;
  return { subject: R.subject(), html: frame({ lang, title: R.subject(), preheader: R.pre(), body }), text };
}
