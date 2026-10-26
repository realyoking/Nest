// Run 24: tiny PDF writer for scans — one JPEG per page (DCTDecode), each page sized A4 (portrait or landscape to
// match the image) with the image fitted and centred. No dependency; output opens in any PDF reader.
const enc = new TextEncoder();
export const A4 = [595.28, 841.89];
export function jpegPdf(pages, { title = 'Scan' } = {}) {
  const chunks = []; const offsets = []; let len = 0;
  const push = (b) => { const u = typeof b === 'string' ? enc.encode(b) : b; chunks.push(u); len += u.length; };
  const obj = (id, body, stream = null) => {
    offsets[id] = len; push(`${id} 0 obj\n${body}\n`);
    if (stream) { push('stream\n'); push(stream); push('\nendstream\n'); }
    push('endobj\n');
  };
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const n = pages.length; const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Kids [${kids}] /Count ${n} >>`);
  pages.forEach((pg, i) => {
    const land = pg.width > pg.height; const [W, H] = land ? [A4[1], A4[0]] : A4;
    const s = Math.min(W / pg.width, H / pg.height); const w = pg.width * s, h = pg.height * s; const x = (W - w) / 2, y = (H - h) / 2;
    const pid = 3 + i * 3, cid = pid + 1, iid = pid + 2;
    obj(pid, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W.toFixed(2)} ${H.toFixed(2)}] /Resources << /XObject << /Im${i} ${iid} 0 R >> >> /Contents ${cid} 0 R >>`);
    const content = enc.encode(`q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im${i} Do Q`);
    obj(cid, `<< /Length ${content.length} >>`, content);
    obj(iid, `<< /Type /XObject /Subtype /Image /Width ${pg.width} /Height ${pg.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${pg.jpeg.length} >>`, pg.jpeg);
  });
  const infoId = 3 + n * 3; obj(infoId, `<< /Title (${String(title).replace(/[()\\]/g, '').replace(/[^\x20-\x7e]/g, '').trim() || 'Scan'}) /Producer (Nest scanner) >>`);
  const xref = len; const count = infoId + 1;
  push(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let i = 1; i < count; i++) push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${count} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(len); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}
