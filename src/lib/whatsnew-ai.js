// "What's new in Nest?" → the model gets the latest ~3 changelog entries (only for these questions) + the page link.
import { latestFor, CHANGELOG_PATH } from '../data/changelog.js';

export const WHATSNEW_RE = /(what'?s new(?! york)|whats new(?! york)|what is new(?! york| jersey| zealand)|new features?|changelog|release notes|latest (update|version|changes)|recent(ly)? (update|change)|(nest|app|你|您).{0,8}(更新|新功能|新增|新嘢|改咗|改了|轉變|改變)|(最近|最新|今次|今日|今天|上次)\s*(有|的|嘅)?\s*(咩|甚麼|什麼|什么|乜|哪些|邊啲)?\s*(更新|新功能|改動|改变|改變)|更新(日誌|日志|內容|内容|咗咩|了什麼|了什么|了甚麼)|最新動態|最新动态|新功能|版本更新)/i;

export function whatsNewBlock(lang = 'zh-Hant') {
  const list = latestFor(lang, 3);
  const lines = list.map((e) => `- ${e.version} (${e.date} HKT) ${e.title}: ${e.items.join(' / ')}`).join('\n');
  return `\n\nWHAT'S NEW IN NEST (the official changelog; the user asked about updates — answer from this only, newest first, briefly, and end with a link to the full list as [${lang === 'en' ? "What's new" : lang === 'zh-Hans' ? '最新动态' : '最新動態'}](${CHANGELOG_PATH})):\n${lines}`;
}
