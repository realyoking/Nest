// Minimal multi-page text PDF writer for tests (no dependencies).
// Latin pages use Helvetica (WinAnsi); CJK pages use the standard non-embedded Adobe CJK font MSung-Light with the
// UniCNS-UCS2-H CMap (pdf.js needs its packed cMaps to read these — the same path the browser uses).
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
const hex = (s) => Array.from(s).map((c) => c.codePointAt(0).toString(16).padStart(4, '0')).join('');
function wrap(text, width) {
  const out = []; let line = '';
  for (const w of text.split(/\s+/)) { if ((line + ' ' + w).trim().length > width) { out.push(line.trim()); line = w; } else line += ` ${w}`; }
  if (line.trim()) out.push(line.trim());
  return out;
}
const wrapCjk = (text, width) => { const a = Array.from(text); const out = []; for (let i = 0; i < a.length; i += width) out.push(a.slice(i, i + width).join('')); return out; };

// pages: array of strings (one per page). cjk: use the CJK font. Returns a Uint8Array.
export function makePdf(pages, { cjk = false } = {}) {
  const objs = [];
  const add = (s) => { objs.push(s); return objs.length; };
  const catalog = add(''); const pagesId = add('');
  const font = cjk
    ? (() => { const desc = add('<< /Type /FontDescriptor /FontName /MSung-Light /Flags 6 /FontBBox [-160 -249 1015 1071] /ItalicAngle 0 /Ascent 880 /Descent -120 /CapHeight 880 /StemV 93 >>');
      const cid = add(`<< /Type /Font /Subtype /CIDFontType0 /BaseFont /MSung-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (CNS1) /Supplement 4 >> /FontDescriptor ${desc} 0 R /DW 1000 >>`);
      return add(`<< /Type /Font /Subtype /Type0 /BaseFont /MSung-Light-UniCNS-UCS2-H /Encoding /UniCNS-UCS2-H /DescendantFonts [${cid} 0 R] >>`); })()
    : add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const kids = [];
  for (const p of pages) {
    const lines = cjk ? wrapCjk(p, 30) : wrap(p, 95);
    const size = cjk ? 14 : 8.5; const lead = cjk ? 17 : 10.2;
    let y = 800; const ops = ['BT', `/F1 ${size} Tf`, `${lead} TL`, `40 ${y} Td`];
    for (const l of lines) ops.push(cjk ? `<${hex(l)}> Tj T*` : `(${esc(l)}) Tj T*`);
    ops.push('ET');
    const stream = ops.join('\n');
    const content = add(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`));
  }
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objs[pagesId - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'; const offs = [];
  objs.forEach((o, i) => { offs.push(Buffer.byteLength(out, 'latin1')); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(out, 'latin1'));
}

// Deterministic English sample: `n` pages × ~`per` words; each page carries a unique fact line (page-specific code word).
const WORDS = 'family school homework reminder weekend library science project garden kitchen music practice morning evening teacher student report review chapter lesson notebook calendar holiday picnic museum harbour ferry market bakery recipe vegetable exercise swimming football badminton piano violin drawing painting reading writing history geography mathematics english chinese computer robot planet ocean mountain forest river bridge island tower'.split(' ');
export const FACT = (i) => `Page ${i} fact: the secret code for page ${i} is ${['AMBER', 'BISON', 'CEDAR', 'DELTA', 'EMBER', 'FJORD', 'GECKO', 'HAVEN', 'IVORY', 'JUNIPER', 'KESTREL', 'LUMEN', 'MARLIN', 'NEBULA', 'OSPREY', 'PEBBLE', 'QUARTZ', 'RAVEN', 'SIERRA', 'TUNDRA'][(i - 1) % 20]}-${1000 + i * 37}.`;
export function englishPages(n = 14, per = 760) {
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  return Array.from({ length: n }, (_, k) => {
    const i = k + 1; const w = [];
    for (let j = 0; j < per; j++) w.push(WORDS[Math.floor(rnd() * WORDS.length)]);
    const mid = Math.floor(per / 2);
    return `${w.slice(0, mid).join(' ')} ${FACT(i)} ${w.slice(mid).join(' ')}`;
  });
}
export const CJK_FACT = (i) => `第${i}頁重點：本頁暗號是「${['紅豆', '綠茶', '藍天', '白雲', '金魚', '銀河', '松樹', '竹林', '梅花', '蘭花', '菊花', '荷葉', '星光', '月亮', '太陽', '彩虹'][(i - 1) % 16]}${100 + i}」。`;
export function cjkPages(n = 14, per = 900) {
  const base = '今日學校通告提醒家長留意功課安排同埋課外活動時間表請準時交回回條多謝合作';
  return Array.from({ length: n }, (_, k) => { const s = Array.from({ length: per }, (_, j) => base[(j * 7 + k) % base.length]).join(''); const mid = Math.floor(per / 2); return `${s.slice(0, mid)}${CJK_FACT(k + 1)}${s.slice(mid)}`; });
}
