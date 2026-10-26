// Chat context helpers shared by the browser (tags dates) and api/chat.js (resolves them on the server clock).
// The model is bad at date arithmetic ("16 Oct is due today" on 18 Oct), so the client never writes relative words:
// it writes machine tags  [[due:2026-10-16]] / [[due:2026-10-20T15:59]]  (deadlines)  and  [[when:2026-10-18T19:00]] (events),
// always in Hong Kong wall time, and the server replaces each tag with a pre-computed status label such as
// "Fri 16 Oct — OVERDUE by 2 days" or "Tue 20 Oct 15:59 — due in 2 days".
const HK = 8 * 3600e3;
const DAY = 864e5;
const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => String(n).padStart(2, '0');
const hkKey = (ms) => new Date(ms + HK).toISOString().slice(0, 10);
const keyMs = (k) => Date.parse(`${k}T00:00:00Z`);

export function hkNow(now = Date.now()) {
  const d = new Date(now + HK);
  const date = d.toISOString().slice(0, 10);
  const weekday = WD[d.getUTCDay()];
  const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  return { date, weekday, time, label: `${weekday}, ${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${time}` };
}

// Tag helpers for the browser. Accepts Date | ms | ISO; all-day → date only.
export function dueTag(v, kind = 'due', allDay = false) {
  const ms = v instanceof Date ? v.getTime() : typeof v === 'number' ? v : Date.parse(v);
  if (!Number.isFinite(ms)) return 'no date';
  const d = new Date(ms + HK).toISOString();
  return `[[${kind}:${allDay ? d.slice(0, 10) : d.slice(0, 16)}]]`;
}

// → { status: 'overdue'|'today'|'tomorrow'|'upcoming'|'past', days, label }
// `days` = calendar days from today (HK) to the date (negative = past).
export function dueStatus(when, now = Date.now(), kind = 'due') {
  const m = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?$/.exec(String(when || '').trim());
  if (!m) return null;
  const [, date, time] = m;
  const today = hkKey(now);
  const days = Math.round((keyMs(date) - keyMs(today)) / DAY);
  const d = new Date(keyMs(date));
  const pretty = `${WD[d.getUTCDay()].slice(0, 3)} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}${time ? ` ${time}` : ''}`;
  const atMs = time ? keyMs(date) - HK + (+time.slice(0, 2)) * 3600e3 + (+time.slice(3)) * 60e3 : null;
  const passedToday = days === 0 && atMs != null && atMs < now;
  let status; let rel;
  if (kind === 'when') {
    if (days < 0 || passedToday) { status = 'past'; rel = days < 0 ? `already happened (${-days} day${days === -1 ? '' : 's'} ago)` : 'earlier today (already started)'; }
    else if (days === 0) { status = 'today'; rel = 'TODAY'; }
    else if (days === 1) { status = 'tomorrow'; rel = 'tomorrow'; }
    else { status = 'upcoming'; rel = `in ${days} days`; }
  } else if (days < 0) { status = 'overdue'; rel = `OVERDUE by ${-days} day${days === -1 ? '' : 's'}`; }
  else if (days === 0) { status = passedToday ? 'overdue' : 'today'; rel = passedToday ? 'was due earlier TODAY (now overdue)' : 'DUE TODAY'; }
  else if (days === 1) { status = 'tomorrow'; rel = 'due TOMORROW'; }
  else { status = 'upcoming'; rel = `due in ${days} days`; }
  return { status, days, label: `${pretty} — ${rel}` };
}

export function annotateDates(text, now = Date.now()) {
  return String(text || '').replace(/\[\[(due|when):([0-9T:-]{10,16})\]\]/g, (all, kind, v) => dueStatus(v, now, kind)?.label || v);
}

// Age in whole years on today's HK date (null when unknown / implausible).
export function ageOf(birthday, now = Date.now()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(birthday || ''));
  if (!m) return null;
  const t = hkKey(now);
  let a = +t.slice(0, 4) - +m[1];
  if (t.slice(5) < `${m[2]}-${m[3]}`) a--;
  return a >= 0 && a < 120 ? a : null;
}

// Language of a message: 'en' when it is (almost) only Latin letters, 'zh-Hant' when it has a real share of CJK,
// null when there is too little text to tell (emoji, numbers, "ok").
export function messageLang(text) {
  const t = String(text || '').replace(/https?:\/\/\S+/g, ' ').replace(/```[\s\S]*?```/g, ' ');
  const latin = (t.match(/[A-Za-z]/g) || []).length;
  const cjk = (t.match(/[\u3400-\u9fff\uf900-\ufaff]/g) || []).length;
  if (cjk >= 1 && cjk / (cjk + latin) >= 0.25) return 'zh-Hant';
  if (latin >= 2 && cjk === 0) return 'en';
  return null;
}

const GREET = /^(?:(?:hi+|hey+|hello+|hiya|yo+|sup|what'?s up|wassup|good (?:morning|afternoon|evening|night)|gm|morning|hello nest|hi nest)\b|你好|您好|哈囉|哈佬|嗨|喂|早晨|早安|午安|晚安)/i;
const FILL = /^(lol|lmao|haha+|hehe+|ok+|okay|k|thx|thanks|thank you|cool|nice|哈+|呵+|嘻+|好|多謝|謝謝|唔該)$/i;
// Greeting / small talk with no request in it ("Hi lol", "hello!", "早晨").
export function isGreeting(text) {
  const t = String(text || '').trim().replace(/[!！.。,，~～?？\s]+$/g, '').replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, '').trim();
  if (!t || t.length > 40) return false;
  if (FILL.test(t)) return true;
  if (!GREET.test(t)) return false;
  const rest = t.replace(GREET, '').replace(/[\s,，!！.。~～]+/g, ' ').trim();
  return !rest || rest.split(' ').every((w) => FILL.test(w) || /^(there|nest|巢|everyone|all|guys|bro|man|dude|:\)|:d)$/i.test(w));
}

// Simplified → Traditional for the characters the flash model most often slips into (unambiguous ones only; 后/干/里/面/发
// etc. are deliberately left out). Applied to streamed zh-Hant replies on the server.
const S2T_PAIRS = '么麼 们們 这這 个個 说說 时時 会會 为為 来來 对對 没沒 吗嗎 还還 让讓 过過 帮幫 么麼 实實 现現 问問 题題 间間 门門 东東 车車 长長 开開 关關 机機 电電 话話 读讀 书書 学學 习習 课課 业業 试試 题題 师師 们們 点點 钟鐘 号號 经經 济濟 动動 动動 买買 卖賣 钱錢 体體 头頭 脑腦 爱愛 欢歡 乐樂 难難 应應 该該 认認 识識 记記 忆憶 觉覺 得得 样樣 么麼 处處 理理 办辦 务務 场場 运運 气氣 预預 报報 温溫 湿濕 风風 云雲 阳陽 际際 网網 络絡 页頁 设設 置置 计計 划劃 节節 欢歡 迎迎 谢謝 请請 给給 让讓 从從 进進 远遠 边邊 东東 万萬 与與 专專 业業 两兩 严嚴 丰豐 临臨 为為 举舉 么麼 义義 乌烏 乔喬 习習 乡鄉 书書 买買 乱亂 争爭 亏虧 产產 亲親 亿億 仅僅 从從 仓倉 们們 价價 众眾 优優 会會 伞傘 传傳 伤傷 伦倫 伪偽 体體 佣傭 侠俠 侣侶 侦偵 侧側 侨僑 俭儉 债債 倾傾 偿償 储儲 儿兒 兑兌 党黨 兰蘭 关關 兴興 养養 兽獸 内內 冈岡 册冊 写寫 军軍 农農 冯馮 决決 况況 冻凍 净淨 凉涼 减減 凑湊 凤鳳 凭憑 击擊 创創 删刪 别別 刹剎 刽劊 剂劑 剑劍 剧劇 劝勸 办辦 务務 动動 励勵 劲勁 劳勞 势勢 勋勳 勤勤 华華 协協 单單 卖賣 卫衛 却卻 厂廠 历歷 压壓 厌厭 厕廁 厘釐 县縣 参參 双雙 发發 变變 叙敘 叶葉 号號 叹嘆 吓嚇 吕呂 吗嗎 启啟 吴吳 呐吶 员員 呜嗚 咏詠 咙嚨 响響 哑啞 哗嘩 唤喚 啰囉 喷噴 嘘噓 团團 园園 围圍 图圖 圆圓 圣聖 场場 坏壞 块塊 坚堅 坛壇 坝壩 坟墳 垄壟 垒壘 垦墾 堕墮 墙牆 壮壯 声聲 壳殼 壶壺 处處 备備 复復 够夠 头頭 夹夾 夺奪 奋奮 奖獎 妆妝 妇婦 妈媽 姗姍 娄婁 娱娛 婴嬰 婶嬸 孙孫 学學 宁寧 宝寶 实實 宠寵 审審 宪憲 宫宮 宽寬 宾賓 对對 寻尋 导導 将將 尔爾 尝嘗 层層 属屬 岁歲 岂豈 岗崗 岛島 岭嶺 峡峽 币幣 帅帥 师師 帐帳 带帶 帮幫 广廣 庄莊 庆慶 库庫 应應 废廢 开開 异異 弃棄 张張 弯彎 弹彈 强強 归歸 录錄 彻徹 径徑 忆憶 忧憂 怀懷 态態 怜憐 总總 恋戀 恳懇 恶惡 恼惱 悦悅 惊驚 惧懼 惨慘 惯慣 愿願 戏戲 战戰 户戶 扑撲 执執 扩擴 扫掃 扬揚 扰擾 抚撫 抢搶 护護 报報 担擔 拟擬 拥擁 拦攔 择擇 挂掛 挡擋 挤擠 挥揮 损損 换換 据據 掷擲 搅攪 携攜 摄攝 摆擺 摇搖 撑撐 敌敵 数數 断斷 无無 旧舊 显顯 晓曉 暂暫 术術 机機 杀殺 杂雜 权權 条條 来來 杨楊 极極 构構 枪槍 柜櫃 标標 栏欄 树樹 样樣 桥橋 档檔 梦夢 检檢 楼樓 横橫 欢歡 欧歐 步步 毕畢 毙斃 气氣 汇匯 汉漢 汤湯 沟溝 没沒 泪淚 泽澤 洁潔 浅淺 测測 济濟 浓濃 涛濤 润潤 涨漲 渐漸 渔漁 湾灣 满滿 滚滾 灭滅 灯燈 灵靈 灾災 炉爐 点點 炼煉 烂爛 热熱 焕煥 爱愛 爷爺 牵牽 犹猶 狮獅 独獨 猎獵 猫貓 献獻 环環 现現 玛瑪 琐瑣 电電 画畫 畅暢 疗療 疯瘋 痒癢 盐鹽 监監 盖蓋 盘盤 着著 矿礦 码碼 础礎 礼禮 祸禍 离離 种種 积積 称稱 稳穩 穷窮 窃竊 竞競 笔筆 笼籠 筑築 签簽 简簡 类類 粮糧 紧緊 纠糾 红紅 约約 级級 纪紀 纯純 纳納 纸紙 线線 练練 组組 细細 织織 终終 绍紹 经經 结結 绘繪 给給 络絡 绝絕 统統 继繼 绩績 续續 维維 综綜 绿綠 缓緩 编編 缘緣 缩縮 网網 罗羅 罚罰 职職 联聯 肠腸 肤膚 肿腫 胁脅 胜勝 脏髒 脑腦 脚腳 舰艦 艺藝 节節 苏蘇 苹蘋 荐薦 药藥 获獲 营營 萝蘿 蓝藍 虑慮 虽雖 蚁蟻 补補 表表 袜襪 装裝 观觀 规規 视視 览覽 觉覺 触觸 计計 订訂 认認 讨討 让讓 训訓 议議 讯訊 记記 讲講 许許 论論 设設 访訪 证證 评評 识識 诉訴 词詞 译譯 试試 诗詩 诚誠 话話 询詢 该該 详詳 语語 误誤 说說 请請 诸諸 读讀 课課 谁誰 调調 谈談 谊誼 谋謀 谢謝 谱譜 贝貝 负負 贡貢 财財 责責 败敗 货貨 质質 购購 贯貫 费費 贴貼 贵貴 贷貸 贸貿 资資 赋賦 赏賞 赔賠 赛賽 赞贊 赠贈 赵趙 赶趕 趋趨 跃躍 践踐 车車 轨軌 转轉 轮輪 软軟 轻輕 载載 较較 辅輔 辆輛 输輸 辩辯 边邊 达達 迁遷 过過 运運 还還 这這 进進 远遠 违違 连連 迟遲 选選 递遞 逻邏 遗遺 邮郵 邻鄰 郑鄭 释釋 钟鐘 钢鋼 钥鑰 钱錢 铁鐵 银銀 链鏈 销銷 锁鎖 错錯 键鍵 长長 门門 闭閉 问問 闲閒 间間 闹鬧 闻聞 阅閱 队隊 阶階 际際 陆陸 陈陳 险險 随隨 隐隱 难難 雾霧 静靜 页頁 顶頂 项項 顺順 须須 顾顧 顿頓 预預 领領 频頻 题題 颜顏 风風 飞飛 饭飯 饮飲 饱飽 饼餅 馆館 驾駕 验驗 骑騎 骗騙 鱼魚 鸟鳥 鸡雞 麦麥 黄黃 齐齊 龙龍';
const EXTRA_S2T = ' 缴繳 浆漿 纳納 级級 约約 纸紙 线線 组組 细細 终終 结結 给給 绝絕 统統 继繼 续續 维維 绩績 网網 罗羅 码碼 础礎 确確 报報 张張 场場 坛壇 块塊 坚堅 垫墊 处處 备備 复復 够夠 头頭 夺奪 奋奮 妈媽 姊姊 孙孫 宝寶 宁寧 宽寬 岁歲 币幣 带帶 帐帳 庆慶 应應 庙廟 废廢 广廣 归歸 录錄 忆憶 忧憂 怀懷 态態 总總 恶惡 惯慣 戏戲 战戰 户戶 扫掃 担擔 拥擁 择擇 挂掛 换換 损損 据據 摄攝 数數 敌敵 断斷 无無 旧舊 显顯 晓曉 术術 杂雜 权權 条條 杨楊 极極 构構 标標 样樣 树樹 桥橋 检檢 楼樓 欢歡 毕畢 气氣 汉漢 汤湯 沟溝 灯燈 灵靈 热熱 爱愛 牍牘 状狀 犹猶 狮獅 献獻 环環 疗療 盖蓋 盘盤 码碼 礼禮 种種 积積 称稱 稳穩 穷窮 窃竊 笔筆 签簽 简簡 类類 粮糧 紧緊 节節 艺藝 药藥 营營 蓝藍 虑慮 补補 装裝 规規 视視 览覽 觉覺 认認 讨討 让讓 训訓 记記 讲講 许許 论論 设設 访訪 证證 评評 识識 诉訴 词詞 译譯 试試 诚誠 询詢 详詳 语語 误誤 请請 诸諸 谈談 谢謝 谱譜 贝貝 负負 贡貢 财財 责責 贤賢 败敗 货貨 质質 购購 贴貼 贵貴 费費 资資 赛賽 赠贈 赢贏 赵趙 轮輪 软軟 轻輕 较較 辆輛 辑輯 输輸 边邊 达達 运運 进進 远遠 连連 选選 递遞 邮郵 邻鄰 释釋 钟鐘 钱錢 铁鐵 银銀 锁鎖 错錯 键鍵 问問 闭閉 闹鬧 阅閱 队隊 阳陽 阴陰 际際 陆陸 险險 随隨 难難 静靜 页頁 顶頂 项項 顺順 须須 顾顧 预預 领領 频頻 题題 颜顏 风風 飞飛 饭飯 饮飲 馆館 马馬 驾駕 验驗 鱼魚 鸡雞 鸟鳥 麦麥 龙龍';
const S2T = new Map((S2T_PAIRS + EXTRA_S2T).split(' ').filter((p) => p.length === 2).map((p) => [p[0], p[1]]));
export const toTraditional = (text) => String(text || '').replace(/[\u4e00-\u9fff]/g, (c) => S2T.get(c) || c);

// Cantonese colloquial → standard Hong Kong written Chinese (書面語). Safety net for zh-Hant replies when the model
// mirrors a Cantonese question (user decision 2026-10-18: zh-Hant = HK 書面語 unless Cantonese is explicitly asked).
// Code blocks and 「quoted」 text are left alone. Streamed deltas: see writtenStream() for the split-word hold-back.
const CANTO_WORDS = [
  ['識唔識', '會不會'], ['識呀', '可以'], ['識㗎', '可以'], ['識得', '懂得'], ['在度', '在這裏'], ['喺度', '在這裏'], ['做唔到', '做不到'],
  ['話我知', '告訴我'], ['講下', '說說'], ['用緊', '正在使用'], ['開緊', '正在開啟'], ['行緊', '正在運行'], ['做緊', '正在做'], ['睇緊', '正在看'], ['揾', '找'], ['揀', '選'], ['點先', '怎樣才'], ['邊度', '哪裏'], ['邊個', '哪個'], ['邊頁', '哪一頁'], ['入面', '裏面'], ['知你', '知道你'], ['下晝', '下午'], ['下昼', '下午'], ['晏晝', '中午'], ['朝早', '早上'], ['琴晚', '昨晚'], ['話要', '說要'], ['搞掂', '完成'], ['尋日', '昨天'], ['琴日', '昨天'], ['聽日', '明天'], ['而家', '現在'], ['點樣', '怎樣'], ['點解', '為甚麼'], ['乜嘢', '甚麼'], ['咩嘢', '甚麼'],
  ['呢個', '這個'], ['呢啲', '這些'], ['呢度', '這裏'], ['呢種', '這種'], ['呢次', '這次'], ['呢位', '這位'], ['呢間', '這間'], ['呢條', '這條'],
  ['嗰個', '那個'], ['嗰啲', '那些'], ['嗰度', '那裏'], ['嗰陣', '那時'], ['佢哋', '他們'], ['我哋', '我們'], ['你哋', '你們'],
  ['係咪', '是否'], ['唔係', '不是'], ['唔使', '不用'], ['唔該', '謝謝'], ['唔好', '不要'], ['有冇', '有沒有'], ['冇', '沒有'], ['咗', '了'], ['嘅', '的'],
  ['喺', '在'], ['佢', '他'], ['唔', '不'], ['嚟', '來'], ['啲', '些'], ['咩', '甚麼'], ['乜', '甚麼'], ['噉', '這樣'], ['咁', '這麼'], ['嘢', '東西'],
  ['睇', '看'], ['畀', '給'], ['攞', '拿'], ['搵', '找'], ['諗', '想'], ['同埋', '以及'], ['吓', '下'], ['㗎', ''], ['喎', ''], ['囉', ''],
];
const CANTO_RE_W = new RegExp(CANTO_WORDS.map(([a]) => a).join('|') + '|(?<![關联聯維])係', 'g');
const CANTO_MAP = new Map([...CANTO_WORDS, ['係', '是']]);
export function toWritten(text) {
  return String(text || '').split(/(```[\s\S]*?(?:```|$)|`[^`\n]*`|「[^」\n]*」)/).map((part, i) => (i % 2 ? part : part.replace(CANTO_RE_W, (m) => CANTO_MAP.get(m) ?? m)
    .replace(/([A-Za-z0-9）)%])\s*同\s*(?=[A-Za-z0-9（(])/g, '$1 和 ')
    .replace(/([圖片表題書線形色像])同(?![樣時一學意事步類期等])(?=[\u4e00-\u9fff])/g, '$1和'))).join('');
}
// For streamed deltas: text is released phrase by phrase — up to the last CJK punctuation mark or newline, never inside an
// unclosed 「quote」 — so no word is split between two conversions; ``` code fences pass through unchanged.
const BOUNDARY = /[。，、！？；：\n）」]/g;
export function writtenStream() {
  let buf = ''; let fence = false;
  const conv = (x) => {
    let out = '';
    for (const seg of x.split(/(```)/)) { if (seg === '```') { fence = !fence; out += seg; } else out += fence ? seg : toWritten(seg); }
    return out;
  };
  const push = (delta) => {
    buf += delta;
    let cut = 0; let m; BOUNDARY.lastIndex = 0;
    while ((m = BOUNDARY.exec(buf))) cut = m.index + 1;
    const q = buf.lastIndexOf('「'); if (q >= 0 && q < cut && buf.indexOf('」', q) < 0) cut = q;
    if (!cut) return '';
    const x = buf.slice(0, cut); buf = buf.slice(cut);
    return conv(x);
  };
  return { push, flush: () => { const x = buf; buf = ''; return conv(x); } };
}
