import './_env.mjs';
// Unit tests for the Apple (iCloud CalDAV) connector and the iCal parser, against mocked CalDAV responses.
// Run: node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { discover, calendarEvents, putObject, multistatus } from '../api/_caldav.js';
import { parseICS, expandEvents, buildICS, patchICS, zonedToUtc } from '../api/_ical.js';

const USER = 'parent@icloud.com'; const PASS = 'abcd-efgh-ijkl-mnop';
const AUTH = 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64');
const HOME_RAW = 'https://p48-caldav.icloud.com:443/123456789/calendars/'; // as iCloud returns it
const HOME = new URL(HOME_RAW).toString(); // normalised (default port dropped)

const ICS_SINGLE = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VTIMEZONE', 'TZID:Asia/Hong_Kong', 'END:VTIMEZONE', 'BEGIN:VEVENT', 'UID:one@x', 'DTSTART;TZID=Asia/Hong_Kong:20261020T090000', 'DTEND;TZID=Asia/Hong_Kong:20261020T103000',
  'SUMMARY:家長日\\, 禮堂', 'LOCATION:School', 'DESCRIPTION:Line 1\\nLine 2 with a very long text that will need folding because it goes past seventy-five octets', 'BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
const ICS_ALLDAY = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:two@x\r\nDTSTART;VALUE=DATE:20261021\r\nDTEND;VALUE=DATE:20261022\r\nSUMMARY:Sports day\r\nEND:VEVENT\r\nEND:VCALENDAR';
const ICS_WEEKLY = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:piano@x', 'DTSTART;TZID=Asia/Hong_Kong:20261003T100000', 'DURATION:PT1H', 'RRULE:FREQ=WEEKLY;BYDAY=SA;COUNT=6', 'EXDATE;TZID=Asia/Hong_Kong:20261024T100000', 'SUMMARY:Piano', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:piano@x', 'RECURRENCE-ID;TZID=Asia/Hong_Kong:20261017T100000', 'DTSTART;TZID=Asia/Hong_Kong:20261017T110000', 'DTEND;TZID=Asia/Hong_Kong:20261017T120000', 'SUMMARY:Piano (moved)', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
const xmlEsc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const MS = (body) => `<?xml version="1.0" encoding="UTF-8"?><multistatus xmlns="DAV:">${body}</multistatus>`;
function mockIcloud(calls) {
  return async (url, init) => {
    calls.push({ url: String(url), method: init.method, depth: init.headers.depth, body: init.body, headers: init.headers });
    const h = (s, b, extra = {}) => new Response(b, { status: s, headers: { 'content-type': 'application/xml', ...extra } });
    if (init.headers.authorization !== AUTH) return h(401, 'Unauthorized');
    const u = String(url);
    if (u === 'https://caldav.icloud.com/' && init.method === 'PROPFIND')
      return h(207, MS('<response><href>/</href><propstat><prop><current-user-principal><href>/123456789/principal/</href></current-user-principal></prop><status>HTTP/1.1 200 OK</status></propstat></response>'));
    if (u === 'https://caldav.icloud.com/123456789/principal/')
      return h(207, MS(`<response><href>/123456789/principal/</href><propstat><prop><calendar-home-set xmlns="urn:ietf:params:xml:ns:caldav"><href xmlns="DAV:">${HOME_RAW}</href></calendar-home-set></prop><status>HTTP/1.1 200 OK</status></propstat></response>`));
    if (u === HOME && init.method === 'PROPFIND')
      return h(207, MS(`<response><href>/123456789/calendars/</href><propstat><prop><resourcetype><collection/></resourcetype><displayname>home</displayname></prop><status>HTTP/1.1 200 OK</status></propstat></response>
        <response><href>/123456789/calendars/home/</href><propstat><prop><displayname>Family &amp; Home</displayname><resourcetype><collection/><C:calendar xmlns:C="urn:ietf:params:xml:ns:caldav"/></resourcetype><A:calendar-color xmlns:A="http://apple.com/ns/ical/">#FF2968FF</A:calendar-color><C:supported-calendar-component-set xmlns:C="urn:ietf:params:xml:ns:caldav"><C:comp name="VEVENT"/></C:supported-calendar-component-set><current-user-privilege-set><privilege><all/></privilege></current-user-privilege-set></prop><status>HTTP/1.1 200 OK</status></propstat></response>
        <response><href>/123456789/calendars/tasks/</href><propstat><prop><displayname>Reminders</displayname><resourcetype><collection/><C:calendar xmlns:C="urn:ietf:params:xml:ns:caldav"/></resourcetype><C:supported-calendar-component-set xmlns:C="urn:ietf:params:xml:ns:caldav"><C:comp name="VTODO"/></C:supported-calendar-component-set></prop><status>HTTP/1.1 200 OK</status></propstat></response>
        <response><href>/123456789/calendars/inbox/</href><propstat><prop><resourcetype><collection/><C:schedule-inbox xmlns:C="urn:ietf:params:xml:ns:caldav"/></resourcetype></prop><status>HTTP/1.1 200 OK</status></propstat></response>`));
    if (u === `${HOME}home/` && init.method === 'REPORT')
      return h(207, MS(`<response><href>/123456789/calendars/home/one.ics</href><propstat><prop><getetag>"e1"</getetag><C:calendar-data xmlns:C="urn:ietf:params:xml:ns:caldav">${xmlEsc(ICS_SINGLE)}</C:calendar-data></prop><status>HTTP/1.1 200 OK</status></propstat></response>
        <response><href>/123456789/calendars/home/two.ics</href><propstat><prop><getetag>"e2"</getetag><C:calendar-data xmlns:C="urn:ietf:params:xml:ns:caldav"><![CDATA[${ICS_ALLDAY}]]></C:calendar-data></prop><status>HTTP/1.1 200 OK</status></propstat></response>
        <response><href>/123456789/calendars/home/piano.ics</href><propstat><prop><getetag>"e3"</getetag><C:calendar-data xmlns:C="urn:ietf:params:xml:ns:caldav">${xmlEsc(ICS_WEEKLY)}</C:calendar-data></prop><status>HTTP/1.1 200 OK</status></propstat></response>`));
    if (init.method === 'PUT') return init.headers['if-match'] === '"stale"' ? h(412, '') : h(201, '', { etag: '"new"' });
    return h(404, 'not found');
  };
}

test('discovery: principal → calendar-home-set → VEVENT calendars only', async () => {
  const calls = []; globalThis.fetch = mockIcloud(calls);
  const d = await discover(USER, PASS);
  assert.equal(d.principal, 'https://caldav.icloud.com/123456789/principal/');
  assert.equal(d.home, HOME);
  assert.equal(d.calendars.length, 1);
  assert.deepEqual(d.calendars[0], { url: `${HOME}home/`, name: 'Family & Home', color: '#FF2968', readOnly: false });
  assert.equal(calls[0].depth, '0'); assert.equal(calls[2].depth, '1');
  assert.ok(calls.every((c) => c.headers.authorization === AUTH));
});

test('bad credentials → clear apple_auth error (401)', async () => {
  globalThis.fetch = mockIcloud([]);
  await assert.rejects(() => discover(USER, 'wrong-password-xx'), (e) => e.code === 'apple_auth' && e.status === 401 && /app-specific password/.test(e.detail));
});

test('redirects keep auth only inside icloud.com', async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => { calls.push(String(url)); if (calls.length === 1) return new Response('', { status: 301, headers: { location: 'https://evil.example.com/' } }); return new Response('', { status: 200 }); };
  await assert.rejects(() => discover(USER, PASS), (e) => e.code === 'apple_bad_url');
  assert.equal(calls.length, 1);
});

test('REPORT time-range: timed (TZID), all-day, weekly RRULE with COUNT, EXDATE and RECURRENCE-ID override', async () => {
  const calls = []; globalThis.fetch = mockIcloud(calls);
  const from = Date.parse('2026-10-01T00:00:00Z'); const to = Date.parse('2026-11-30T00:00:00Z');
  const ev = await calendarEvents(USER, PASS, `${HOME}home/`, from, to);
  assert.match(calls[0].body, /time-range start="20261001T000000Z" end="20261130T000000Z"/);
  const one = ev.find((e) => e.uid === 'one@x');
  assert.equal(one.start, '2026-10-20T01:00:00.000Z'); assert.equal(one.end, '2026-10-20T02:30:00.000Z');
  assert.equal(one.title, '家長日, 禮堂'); assert.match(one.description, /Line 1\nLine 2/); assert.equal(one.etag, '"e1"');
  assert.equal(one.href, `${HOME}home/one.ics`);
  const two = ev.find((e) => e.uid === 'two@x');
  assert.deepEqual([two.allDay, two.start, two.end], [true, '2026-10-21', '2026-10-22']);
  const piano = ev.filter((e) => e.uid === 'piano@x').map((e) => [e.start, e.title]);
  // COUNT=6 from Oct 3: 3, 10, 17 (moved to 11:00), 24 (EXDATE), 31, Nov 7 → Nov 14 is past COUNT.
  assert.deepEqual(piano, [
    ['2026-10-03T02:00:00.000Z', 'Piano'], ['2026-10-10T02:00:00.000Z', 'Piano'], ['2026-10-17T03:00:00.000Z', 'Piano (moved)'],
    ['2026-10-31T02:00:00.000Z', 'Piano'], ['2026-11-07T02:00:00.000Z', 'Piano'],
  ]);
  assert.ok(ev.filter((e) => e.uid === 'piano@x').every((e) => e.recurring));
});

test('RRULE: monthly by ordinal weekday, yearly, daily UNTIL, DST zone', () => {
  const ics = ['BEGIN:VCALENDAR',
    'BEGIN:VEVENT', 'UID:m', 'DTSTART;TZID=Asia/Hong_Kong:20260914T190000', 'DTEND;TZID=Asia/Hong_Kong:20260914T200000', 'RRULE:FREQ=MONTHLY;BYDAY=2MO', 'SUMMARY:PTA', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:y', 'DTSTART;VALUE=DATE:20200801', 'RRULE:FREQ=YEARLY', 'SUMMARY:Birthday', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:d', 'DTSTART:20261028T000000Z', 'DTEND:20261028T003000Z', 'RRULE:FREQ=DAILY;INTERVAL=2;UNTIL=20261103T000000Z', 'SUMMARY:Run', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:ny', 'DTSTART;TZID=America/New_York:20261030T090000', 'DTEND;TZID=America/New_York:20261030T100000', 'RRULE:FREQ=WEEKLY;COUNT=2', 'SUMMARY:NY call', 'END:VEVENT',
    'END:VCALENDAR'].join('\r\n');
  const ev = expandEvents(parseICS(ics), Date.parse('2026-10-01T00:00:00Z'), Date.parse('2026-12-01T00:00:00Z'));
  assert.deepEqual(ev.filter((e) => e.uid === 'm').map((e) => e.start), ['2026-10-12T11:00:00.000Z', '2026-11-09T11:00:00.000Z']);
  assert.deepEqual(ev.filter((e) => e.uid === 'y').map((e) => e.start), []);
  const yb = expandEvents(parseICS(ics), Date.parse('2026-07-01T00:00:00Z'), Date.parse('2026-09-01T00:00:00Z')).filter((e) => e.uid === 'y');
  assert.deepEqual(yb.map((e) => [e.start, e.end, e.allDay]), [['2026-08-01', '2026-08-02', true]]);
  assert.deepEqual(ev.filter((e) => e.uid === 'd').map((e) => e.start.slice(0, 10)), ['2026-10-28', '2026-10-30', '2026-11-01', '2026-11-03'] /* UNTIL is inclusive */);
  // 09:00 New York is 13:00Z before the DST change (Nov 1 2026) and 14:00Z after.
  assert.deepEqual(ev.filter((e) => e.uid === 'ny').map((e) => e.start), ['2026-10-30T13:00:00.000Z', '2026-11-06T14:00:00.000Z']);
});

test('zonedToUtc handles Hong Kong and floating times', () => {
  assert.equal(new Date(zonedToUtc({ y: 2026, m: 10, d: 18, h: 8 }, 'Asia/Hong_Kong')).toISOString(), '2026-10-18T00:00:00.000Z');
  const [f] = parseICS('BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:f\nDTSTART:20261018T080000\nSUMMARY:x\nEND:VEVENT\nEND:VCALENDAR');
  assert.equal(new Date(f.start.ms).toISOString(), '2026-10-18T00:00:00.000Z');
});

test('buildICS / patchICS round-trip, keeps VALARM, bumps SEQUENCE, folds long lines', () => {
  const ics = buildICS({ uid: 'n@heynest', title: 'Test, with; chars', allDay: false, start: '2026-10-20T02:00:00.000Z', end: '2026-10-20T03:00:00.000Z', location: 'HK' }, 0);
  const [e] = parseICS(ics);
  assert.equal(e.summary, 'Test, with; chars'); assert.equal(new Date(e.start.ms).toISOString(), '2026-10-20T02:00:00.000Z');
  const patched = patchICS(ICS_SINGLE, { title: 'Parents day', allDay: true, start: '2026-10-22', end: '2026-10-23' }, 0);
  const [p] = parseICS(patched);
  assert.equal(p.summary, 'Parents day'); assert.ok(p.start.allDay); assert.equal(p.location, undefined);
  assert.match(patched, /BEGIN:VALARM\r\nTRIGGER:-PT15M/); assert.match(patched, /SEQUENCE:1/);
  assert.ok(patched.split('\r\n').every((l) => Buffer.byteLength(l) <= 75));
});

test('PUT create uses If-None-Match, update conflict → apple_conflict', async () => {
  const calls = []; globalThis.fetch = mockIcloud(calls);
  const r = await putObject(USER, PASS, `${HOME}home/new.ics`, 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n', { create: true });
  assert.equal(r.etag, '"new"'); assert.equal(calls[0].headers['if-none-match'], '*');
  await assert.rejects(() => putObject(USER, PASS, `${HOME}home/one.ics`, 'x', { etag: '"stale"' }), (e) => e.code === 'apple_conflict');
});

test('server encryption keeps the Apple password unreadable without TOKEN_ENC_KEY', async () => {
  process.env.TOKEN_ENC_KEY = crypto.randomBytes(32).toString('base64');
  const { encrypt, decrypt } = await import('../api/_google-lib.js');
  const blob = encrypt(JSON.stringify({ u: USER, p: PASS }), 'uid1', `apple:${USER}`);
  assert.ok(!blob.includes(PASS) && !Buffer.from(blob.slice(3), 'base64url').toString('latin1').includes(PASS));
  assert.equal(JSON.parse(decrypt(blob, 'uid1', `apple:${USER}`)).p, PASS);
  assert.throws(() => decrypt(blob, 'uid2', `apple:${USER}`));
});

test('multistatus ignores non-200 propstats', () => {
  const r = multistatus(MS('<response><href>/a/</href><propstat><prop><displayname>A</displayname></prop><status>HTTP/1.1 200 OK</status></propstat><propstat><prop><getctag/></prop><status>HTTP/1.1 404 Not Found</status></propstat></response>'));
  assert.equal(r.length, 1); assert.match(r[0].props, /displayname/); assert.doesNotMatch(r[0].props, /getctag/);
});
