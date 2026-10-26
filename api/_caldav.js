// iCloud CalDAV client (Apple Calendar connector). Node runtime, no dependencies.
// Discovery: PROPFIND https://caldav.icloud.com/ (current-user-principal) → principal (calendar-home-set) →
// home (Depth 1: calendars). Events: REPORT calendar-query with a time-range. Writes: PUT / DELETE of .ics objects.
// Auth: HTTP Basic with the Apple ID + an app-specific password (appleid.apple.com → Sign-In and Security →
// App-Specific Passwords). Only *.icloud.com hosts are ever contacted (no SSRF through stored or posted URLs).
import { parseICS, expandEvents } from './_ical.js';

export const ICLOUD = 'https://caldav.icloud.com/';
export const isIcloudUrl = (u) => { try { const x = new URL(u); return x.protocol === 'https:' && (x.hostname === 'icloud.com' || x.hostname.endsWith('.icloud.com')); } catch { return false; } };
const err = (code, status, detail = '') => Object.assign(new Error(code), { code, status, detail });

const basic = (user, pass) => 'Basic ' + Buffer.from(`${user}:${pass}`, 'utf8').toString('base64');

// One DAV request; follows up to 4 redirects manually (fetch would drop Authorization across hosts), only within iCloud.
export async function dav(url, { method = 'PROPFIND', user, pass, depth, body, headers = {}, timeout = 12000 } = {}) {
  let u = url;
  for (let hop = 0; hop < 5; hop++) {
    if (!isIcloudUrl(u)) throw err('apple_bad_url', 400);
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeout);
    let r;
    try {
      r = await fetch(u, {
        method, redirect: 'manual', signal: ctl.signal,
        headers: { authorization: basic(user, pass), ...(depth != null ? { depth: String(depth) } : {}), ...(body ? { 'content-type': headers['content-type'] || 'application/xml; charset=utf-8' } : {}), ...headers },
        body,
      });
    } catch (e) { throw err(e.name === 'AbortError' ? 'apple_timeout' : 'apple_network', 504, String(e.message || '').slice(0, 120)); }
    finally { clearTimeout(t); }
    if ([301, 302, 307, 308].includes(r.status) && r.headers.get('location')) { u = new URL(r.headers.get('location'), u).toString(); continue; }
    const text = await r.text();
    if (r.status === 401) throw err('apple_auth', 401, 'Apple rejected the Apple ID or app-specific password');
    if (r.status === 403) throw err('apple_forbidden', 403, 'iCloud refused access (403)');
    return { status: r.status, text, url: u, etag: r.headers.get('etag') || '' };
  }
  throw err('apple_redirects', 502);
}

// ---------- tiny multistatus XML reader (namespace prefixes ignored) ----------
const decodeXml = (s) => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&');
const blocks = (xml, name) => { const re = new RegExp(`<(?:[\\w-]+:)?${name}\\b[^>]*?(?:/>|>([\\s\\S]*?)</(?:[\\w-]+:)?${name}\\s*>)`, 'gi'); const out = []; let m; while ((m = re.exec(xml))) out.push(m[1] ?? ''); return out; };
const first = (xml, name) => blocks(xml, name)[0];
const has = (xml, name) => new RegExp(`<(?:[\\w-]+:)?${name}\\b`, 'i').test(xml || '');
export function multistatus(xml) {
  return blocks(xml, 'response').map((r) => {
    const okProps = blocks(r, 'propstat').filter((ps) => /\s200\s/.test(first(ps, 'status') || ' 200 ')).map((ps) => first(ps, 'prop') || '').join('');
    return { href: decodeXml((first(r, 'href') || '').trim()), props: okProps, raw: r };
  });
}

// Apple ID + app-specific password → { principal, home, calendars: [{ url, name, color, readOnly }] }
export async function discover(user, pass) {
  const p1 = await dav(ICLOUD, { user, pass, depth: 0, body: '<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/></d:prop></d:propfind>' });
  if (p1.status !== 207) throw err('apple_discovery', 502, `principal lookup returned ${p1.status}`);
  const pHref = decodeXml((first(first(p1.text, 'current-user-principal') || '', 'href') || '').trim());
  if (!pHref) throw err('apple_discovery', 502, 'no current-user-principal');
  const principal = new URL(pHref, p1.url).toString();
  const p2 = await dav(principal, { user, pass, depth: 0, body: '<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><c:calendar-home-set/></d:prop></d:propfind>' });
  if (p2.status !== 207) throw err('apple_discovery', 502, `calendar-home-set returned ${p2.status}`);
  const hHref = decodeXml((first(first(p2.text, 'calendar-home-set') || '', 'href') || '').trim());
  if (!hHref) throw err('apple_discovery', 502, 'no calendar-home-set');
  const home = new URL(hHref, principal).toString();
  const calendars = await listCalendars(user, pass, home);
  return { principal, home, calendars };
}

export async function listCalendars(user, pass, home) {
  const r = await dav(home, { user, pass, depth: 1, body: '<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:a="http://apple.com/ns/ical/"><d:prop><d:displayname/><d:resourcetype/><a:calendar-color/><c:supported-calendar-component-set/><d:current-user-privilege-set/></d:prop></d:propfind>' });
  if (r.status !== 207) throw err('apple_discovery', 502, `calendar list returned ${r.status}`);
  return multistatus(r.text).filter((x) => has(first(x.props, 'resourcetype') || '', 'calendar'))
    .filter((x) => { const comps = first(x.props, 'supported-calendar-component-set'); return comps == null || /name=["']VEVENT["']/i.test(comps); })
    .map((x) => {
      const priv = first(x.props, 'current-user-privilege-set');
      return {
        url: new URL(x.href, home).toString(),
        name: decodeXml((first(x.props, 'displayname') || '').trim()) || 'iCloud',
        color: (decodeXml(first(x.props, 'calendar-color') || '').trim().match(/^#[0-9a-f]{6}/i) || [''])[0],
        readOnly: priv != null && !/<(?:[\w-]+:)?(write|write-content|all)\b/i.test(priv),
      };
    });
}

const stamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
// Occurrences in [fromMs, toMs) of one calendar: [{ href, etag, uid, title, start, end, allDay, recurring, … }]
export async function calendarEvents(user, pass, calUrl, fromMs, toMs) {
  const body = `<?xml version="1.0" encoding="utf-8"?><c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:getetag/><c:calendar-data/></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"><c:time-range start="${stamp(fromMs)}" end="${stamp(toMs)}"/></c:comp-filter></c:comp-filter></c:filter></c:calendar-query>`;
  const r = await dav(calUrl, { method: 'REPORT', user, pass, depth: 1, body });
  if (r.status !== 207) throw err('apple_report', 502, `REPORT returned ${r.status}`);
  const out = [];
  for (const x of multistatus(r.text)) {
    const data = decodeXml(first(x.props, 'calendar-data') || '');
    if (!data.includes('BEGIN:VCALENDAR')) continue;
    const etag = decodeXml((first(x.props, 'getetag') || '').trim());
    const href = new URL(x.href, calUrl).toString();
    for (const o of expandEvents(parseICS(data), fromMs, toMs)) out.push({ ...o, href, etag });
  }
  return out;
}

export async function getObject(user, pass, href) {
  const r = await dav(href, { method: 'GET', user, pass });
  if (r.status !== 200) throw err('apple_get', r.status === 404 ? 404 : 502, `GET returned ${r.status}`);
  return { text: r.text, etag: r.etag };
}
export async function putObject(user, pass, href, ics, { etag, create } = {}) {
  const headers = { 'content-type': 'text/calendar; charset=utf-8', ...(create ? { 'if-none-match': '*' } : etag ? { 'if-match': etag } : {}) };
  const r = await dav(href, { method: 'PUT', user, pass, body: ics, headers });
  if (r.status === 412) throw err('apple_conflict', 409, 'the event changed on another device');
  if (![200, 201, 204].includes(r.status)) throw err('apple_put', 502, `PUT returned ${r.status}`);
  return { etag: r.etag };
}
export async function deleteObject(user, pass, href, etag) {
  const r = await dav(href, { method: 'DELETE', user, pass, headers: etag ? { 'if-match': etag } : {} });
  if (r.status === 412) throw err('apple_conflict', 409, 'the event changed on another device');
  if (![200, 204, 404].includes(r.status)) throw err('apple_delete', 502, `DELETE returned ${r.status}`);
}
