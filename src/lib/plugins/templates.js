// Creator Studio templates: a small form → a complete, valid plugin bundle. Pure JS (unit-tested).
const slug = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
export const idFrom = (name, fallback = 'my-plugin') => { const s = slug(name); return s.length >= 3 ? s : `${fallback}-${Math.random().toString(36).slice(2, 6)}`; };
const js = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
const hex = (c, d) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c.toLowerCase() : d);
// mix two #rrggbb colours (0..1)
export function mix(a, b, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

export const TEMPLATE_DEFAULTS = {
  theme: { name: 'My Theme', nameZh: '我的主題', bg: '#fdf2f8', bg2: '#fce7f3', surface: '#ffffff', ink: '#3b0a2a', font: 'Quicksand', dark: false },
  tab: { name: 'My Checklist', nameZh: '我的清單', icon: 'check', content: '溫習中文默書\nRevise maths chapter 3\n執書包', checklist: true },
  widget: { name: 'My Widget', nameZh: '我的小工具', type: 'countdown', date: '', text: '加油！' },
  reminders: { name: 'Revision Reminders', nameZh: '溫習提醒', items: [{ title: '溫習 30 分鐘', time: '19:30', days: 'weekdays' }] },
};

export function fromTemplate(kind, f = {}) {
  const v = { ...TEMPLATE_DEFAULTS[kind], ...f };
  const base = { id: f.id || idFrom(v.name, kind), name: String(v.name || '').slice(0, 40) || 'Plugin', nameZh: String(v.nameZh || '').slice(0, 40) || undefined, version: f.version || '1.0.0' };
  if (kind === 'theme') {
    const bg = hex(v.bg, '#ffffff'); const bg2 = hex(v.bg2, bg); const surface = hex(v.surface, '#ffffff'); const ink = hex(v.ink, '#0a0a0a');
    return {
      manifest: { ...base, category: 'theme', description: 'A custom colour theme for Nest.', descriptionZh: '自訂的 Nest 顏色主題。', capabilities: ['theme', 'font', 'background'], permissions: [], settings: [],
        theme: { vars: { '--bg': bg, '--surface': surface, '--ink': ink, '--ink-2': mix(ink, surface, 0.25), '--muted': mix(ink, surface, 0.5), '--line': mix(surface, ink, 0.1), '--line-2': mix(surface, ink, 0.16), '--soft': mix(surface, ink, 0.05), '--soft-2': mix(surface, ink, 0.03), '--on-ink': surface },
          font: v.font || undefined, headingFont: v.font || undefined, background: bg2 !== bg ? { colors: [bg, bg2], angle: 180 } : { type: 'color', colors: [bg] }, scheme: v.dark ? 'dark' : 'light' } },
      html: '', css: '', js: '',
    };
  }
  if (kind === 'tab') {
    const items = String(v.content || '').split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 60);
    return {
      manifest: { ...base, category: 'productivity', description: 'A custom tab.', descriptionZh: '自訂分頁。', capabilities: ['tab'], permissions: [], settings: [], tab: { title: base.name.slice(0, 20), titleZh: (base.nameZh || '').slice(0, 12) || undefined, icon: v.icon || 'check' } },
      html: '<main class="t"><h1 id="h"></h1><ul id="l"></ul></main>',
      css: '.t{max-width:560px;margin:0 auto;padding:20px 18px 40px}h1{font-weight:900;font-size:30px;letter-spacing:-.03em;margin:0 0 16px}ul{list-style:none;padding:0;margin:0}li{display:flex;gap:12px;align-items:center;background:var(--surface,#fff);border:1.5px solid var(--line,#ebebeb);border-radius:16px;padding:14px 16px;margin-bottom:10px;font-weight:700}li.done span{text-decoration:line-through;color:var(--muted,#767676)}input{width:22px;height:22px;accent-color:var(--ink,#0a0a0a)}',
      js: `const ITEMS=${js(items)},CHECK=${v.checklist ? 'true' : 'false'};const zh=nest.context.lang!=='en';document.getElementById('h').textContent=zh?${js(base.nameZh || base.name)}:${js(base.name)};
const l=document.getElementById('l');let done={};function draw(){l.innerHTML='';ITEMS.forEach((t,i)=>{const li=document.createElement('li');if(done[i])li.className='done';if(CHECK){const c=document.createElement('input');c.type='checkbox';c.checked=!!done[i];c.onchange=()=>{done[i]=c.checked;nest.storage.set('done',done).catch(()=>{});draw();};li.appendChild(c);}const s=document.createElement('span');s.textContent=t;li.appendChild(s);l.appendChild(li);});}
nest.storage.get('done').then((d)=>{done=d||{};draw();}).catch(draw);`,
    };
  }
  if (kind === 'widget') {
    const type = ['countdown', 'note', 'clock'].includes(v.type) ? v.type : 'note';
    return {
      manifest: { ...base, category: 'tools', description: 'A custom Home widget.', descriptionZh: '自訂主頁小工具。', capabilities: ['widget'], permissions: [], settings: [], widget: { title: base.name.slice(0, 30), titleZh: (base.nameZh || '').slice(0, 20) || undefined, height: 90 } },
      html: '<div class="w"><b id="big"></b><span id="small"></span></div>',
      css: '.w{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}#big{font-weight:900;font-size:34px;letter-spacing:-.03em;font-variant-numeric:tabular-nums}#small{color:var(--muted,#767676);font-weight:700}',
      js: `const T=${js(type)},D=${js(v.date || '')},X=${js(String(v.text || '').slice(0, 200))};const zh=nest.context.lang!=='en';const b=document.getElementById('big'),s=document.getElementById('small');
function hk(){return new Date(Date.now()+8*3600e3);}
function draw(){if(T==='clock'){const d=hk();b.textContent=d.toISOString().slice(11,16);s.textContent=X;}else if(T==='countdown'&&D){const n=Math.round((Date.parse(D)-Date.parse(hk().toISOString().slice(0,10)))/864e5);b.textContent=n>0?n:'0';s.textContent=(zh?(n>0?'天後 · ':'今天 · '):(n>0?'days to go · ':'today · '))+X;}else{b.textContent=X;s.textContent='';}}
draw();setInterval(draw,30000);`,
    };
  }
  if (kind === 'reminders') {
    const items = (Array.isArray(v.items) ? v.items : []).slice(0, 8).map((x) => ({ title: String(x.title || '').slice(0, 100), time: /^([01]\d|2[0-3]):[0-5]\d$/.test(x.time) ? x.time : '19:00', days: ['daily', 'weekdays', 'weekends'].includes(x.days) ? x.days : 'daily' })).filter((x) => x.title);
    return {
      manifest: { ...base, category: 'family', description: 'Creates the next reminders automatically when you open Nest.', descriptionZh: '開啟 Nest 時自動建立接下來的提醒。', capabilities: ['automation'], permissions: ['reminders.write'], settings: [] },
      html: '', css: '',
      js: `const ITEMS=${js(items)};const HK=8*3600e3;
function ok(d,days){const w=new Date(d+HK).getUTCDay();return days==='daily'||(days==='weekdays'&&w>0&&w<6)||(days==='weekends'&&(w===0||w===6));}
(async()=>{let made={};try{made=(await nest.storage.get('made'))||{};}catch(e){}const now=Date.now();
for(const it of ITEMS){for(let k=0;k<3;k++){const day=new Date(now+HK+k*864e5).toISOString().slice(0,10);const at=Date.parse(day+'T'+it.time+':00+08:00');if(at<now||!ok(at,it.days))continue;
const key=it.title+'|'+day;if(made[key])break;try{await nest.reminders.create({title:it.title,dueAt:at});made[key]=1;}catch(e){}break;}}
const keep={};Object.keys(made).filter((k)=>k.slice(-10)>=new Date(now+HK-864e5).toISOString().slice(0,10)).forEach((k)=>keep[k]=1);await nest.storage.set('made',keep).catch(()=>{});})();`,
    };
  }
  throw new Error('unknown_template');
}

// Starter bundle for "write code".
export function blankBundle() {
  return {
    manifest: { id: idFrom('', 'my-plugin'), name: 'My Plugin', nameZh: '我的插件', version: '1.0.0', category: 'tools', description: 'My first Nest plugin.', descriptionZh: '我的第一個 Nest 插件。', capabilities: ['widget'], permissions: [], settings: [], widget: { title: 'My Plugin', titleZh: '我的插件', height: 100 } },
    html: '<div class="hello"><b id="msg"></b><button id="b">+1</button></div>',
    css: '.hello{display:flex;align-items:center;justify-content:space-between;gap:12px}#msg{font-weight:900;font-size:22px}button{border:0;border-radius:999px;padding:10px 16px;background:var(--ink,#0a0a0a);color:var(--on-ink,#fff);font-weight:800}',
    js: "let n=0;const zh=nest.context.lang!=='en';const m=document.getElementById('msg');\nfunction draw(){m.textContent=(zh?'按了 ':'Tapped ')+n+(zh?' 次':' times');}\nnest.storage.get('n').then((v)=>{n=v||0;draw();});\ndocument.getElementById('b').onclick=()=>{n++;nest.storage.set('n',n);draw();};\ndraw();",
  };
}
