// First-party plugins by the verified "Nest" creator. Seeded into the store by the server (api/_plugins.js, idempotent
// by SEED_VERSION) and used by the mock build. Icons / screenshots are static files in public/plugins/<id>/.
export const SEED_VERSION = 4; // v4: Countdown add without <form> (sandbox blocks form submission)
export const NEST_CREATOR = { uid: 'nest-official', handle: 'nest', bio: 'Official plugins from the Nest team. 由 Nest 團隊製作的官方插件。', pfp: '/plugins/nest/pfp.svg', verified: true };

const shots = (id, n = 2) => Array.from({ length: n }, (_, i) => `/plugins/${id}/shot-${i + 1}.png`);

const SKY_VARIANT = {
  day: { vars: { '--bg': '#eaf4ff', '--surface': 'rgba(255,255,255,0.88)', '--soft': '#eef5fd', '--soft-2': '#f5f9fe', '--line': '#d9e7f6', '--line-2': '#c8dbef', '--ink': '#0c2340', '--ink-2': '#2c4666', '--muted': '#5f7895', '--on-ink': '#ffffff' },
    background: { colors: ['#9fd0ff', '#d6ecff', '#f4f9ff'], angle: 180, image: '/plugins/sky-theme/clouds.svg', size: 'cover' } },
  sunset: { vars: { '--bg': '#fff1e8', '--surface': 'rgba(255,255,255,0.88)', '--soft': '#fff3ec', '--soft-2': '#fff8f4', '--line': '#f5dccd', '--line-2': '#eccab6', '--ink': '#3a1a12', '--ink-2': '#5e3326', '--muted': '#946556', '--on-ink': '#ffffff' },
    background: { colors: ['#ff9a76', '#ffc9a8', '#ffe9dc'], angle: 180, image: '/plugins/sky-theme/clouds.svg', size: 'cover' } },
  night: { scheme: 'dark', vars: { '--bg': '#0b1530', '--surface': 'rgba(18,30,62,0.9)', '--soft': '#16244a', '--soft-2': '#121e3e', '--line': '#22335f', '--line-2': '#2d4174', '--ink': '#eef3ff', '--ink-2': '#c6d3f2', '--muted': '#8fa2cc', '--on-ink': '#0b1530', '--red': '#ff7a6e' },
    background: { colors: ['#050b1f', '#13245a', '#2a3f7c'], angle: 180, image: '/plugins/sky-theme/stars.svg', size: 'cover' } },
};

const DARK_VARIANT = {
  soft: { scheme: 'dark', vars: { '--bg': '#101114', '--surface': '#17181c', '--soft': '#1f2026', '--soft-2': '#1a1b20', '--line': '#2a2b31', '--line-2': '#36373e', '--ink': '#f1f2f4', '--ink-2': '#cdd0d6', '--muted': '#959aa3', '--on-ink': '#101114', '--red': '#ff6b5e' } },
  black: { scheme: 'dark', vars: { '--bg': '#000000', '--surface': '#0a0a0a', '--soft': '#141414', '--soft-2': '#0f0f0f', '--line': '#1f1f1f', '--line-2': '#2b2b2b', '--ink': '#ffffff', '--ink-2': '#d4d4d4', '--muted': '#8f8f8f', '--on-ink': '#000000', '--red': '#ff6b5e' } },
};

const COUNTDOWN_HTML = `<main class="cd">
  <header><h1 id="t"></h1><p id="sub"></p></header>
  <section id="list"></section>
  <div class="add"><input id="name" maxlength="40" enterkeyhint="done"><input id="date" type="date"><button id="addb" type="button"></button></div>
  <p class="fine" id="fine"></p>
</main>`;
const COUNTDOWN_CSS = `.cd{max-width:560px;margin:0 auto;padding:20px 18px 40px}
h1{font-weight:900;font-size:30px;letter-spacing:-.03em;margin:0 0 4px}#sub{margin:0 0 18px;color:var(--muted,#767676);font-weight:700}
.item{background:var(--surface,#fff);border:1.5px solid var(--line,#ebebeb);border-radius:20px;padding:16px 18px;margin-bottom:12px;display:flex;align-items:center;gap:14px}
.num{font-weight:900;font-size:38px;line-height:1;min-width:84px;text-align:center}.num small{display:block;font-size:12px;color:var(--muted,#767676);font-weight:800;margin-top:4px}
.meta{flex:1;min-width:0}.meta b{display:block;font-size:17px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.meta span{color:var(--muted,#767676);font-size:13px;font-weight:700}
.acts{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.btn{border:0;border-radius:999px;padding:8px 12px;font-weight:800;font-size:13px;background:var(--soft,#f5f5f5);color:var(--ink,#0a0a0a)}
.btn.x{background:none;color:var(--muted,#767676)}
.add{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:18px}
input{height:46px;border-radius:14px;border:1.5px solid var(--line-2,#dedede);padding:0 12px;font:inherit;background:var(--surface,#fff);color:var(--ink,#0a0a0a);min-width:0}
#name{grid-column:1/3}#addb{height:46px;border-radius:999px;border:0;padding:0 20px;background:var(--ink,#0a0a0a);color:var(--on-ink,#fff);font-weight:800}
.fine{color:var(--muted,#767676);font-size:12px;margin-top:14px}.empty{color:var(--muted,#767676);font-weight:700;padding:20px 0}`;
const COUNTDOWN_JS = `const zh=nest.context.lang!=='en';const L=zh?{t:'倒數',sub:'重要日子還有幾多天',add:'加入',name:'名稱，例如考試',d:'天',today:'就是今天',past:'已過',rem:'前一天提醒',del:'刪除',empty:'未有倒數。加入第一個吧。',done:'已加入提醒',no:'未獲提醒權限',fine:'倒數只儲存在這部裝置。'}:{t:'Countdown',sub:'Days until the dates that matter',add:'Add',name:'Name, e.g. Exams',d:'days',today:'Today',past:'Passed',rem:'Remind me the day before',del:'Delete',empty:'No countdowns yet. Add your first one.',done:'Reminder added',no:'No reminder permission',fine:'Countdowns are saved on this device only.'};
const $=(i)=>document.getElementById(i);$('t').textContent=L.t;$('sub').textContent=L.sub;$('addb').textContent=L.add;$('name').placeholder=L.name;$('fine').textContent=L.fine;
let items=[];const s=nest.settings||{};
function days(d){const hk=new Date(Date.now()+8*3600e3).toISOString().slice(0,10);return Math.round((Date.parse(d)-Date.parse(hk))/864e5);}
function render(){const l=$('list');l.innerHTML='';const all=items.slice();if(s.title&&s.date)all.unshift({name:s.title,date:s.date,fixed:true});
if(!all.length){const p=document.createElement('p');p.className='empty';p.textContent=L.empty;l.appendChild(p);return;}
all.sort((a,b)=>a.date.localeCompare(b.date)).forEach((it)=>{const n=days(it.date);const el=document.createElement('div');el.className='item';
const num=document.createElement('div');num.className='num';num.textContent=n>0?n:(n===0?'0':'—');const sm=document.createElement('small');sm.textContent=n>0?L.d:(n===0?L.today:L.past);num.appendChild(sm);
const meta=document.createElement('div');meta.className='meta';const b=document.createElement('b');b.textContent=it.name;const sp=document.createElement('span');sp.textContent=it.date;meta.append(b,sp);
const acts=document.createElement('div');acts.className='acts';
if(n>1){const r=document.createElement('button');r.className='btn';r.textContent=L.rem;r.onclick=async()=>{try{await nest.reminders.create({title:it.name,dueAt:Date.parse(it.date+'T09:00:00+08:00')-864e5});nest.ui.toast(L.done);}catch(e){nest.ui.toast(L.no);}};acts.appendChild(r);}
if(!it.fixed){const x=document.createElement('button');x.className='btn x';x.textContent=L.del;x.onclick=()=>{items=items.filter((y)=>y!==it);save();};acts.appendChild(x);}
el.append(num,meta,acts);l.appendChild(el);});}
function save(){nest.storage.set('items',items).catch(()=>{});render();}
const add=()=>{const name=$('name').value.trim();const date=$('date').value;if(!name||!date){nest.ui.toast(zh?'請輸入名稱及日期':'Add a name and a date').catch(()=>{});return;}items.push({name,date});$('name').value='';save();};$('addb').onclick=add;$('name').onkeydown=(e)=>{if(e.key==='Enter')add();};
nest.storage.get('items').then((v)=>{items=Array.isArray(v)?v:[];render();}).catch(render);`;

const POMO_HTML = `<main class="pm"><h1 id="t"></h1><p id="phase"></p>
<div class="ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" class="bg"/><circle cx="60" cy="60" r="52" class="fg" id="arc"/></svg><div class="time" id="time">25:00</div></div>
<div class="row"><button id="go" class="pri"></button><button id="reset"></button><button id="skip"></button></div>
<p class="stat" id="stat"></p></main>`;
const POMO_CSS = `.pm{max-width:420px;margin:0 auto;padding:22px 18px 40px;text-align:center}
h1{font-weight:900;font-size:30px;letter-spacing:-.03em;margin:0}#phase{color:var(--muted,#767676);font-weight:800;margin:6px 0 18px}
.ring{position:relative;width:min(78vw,280px);margin:0 auto}.ring svg{width:100%;transform:rotate(-90deg)}
circle{fill:none;stroke-width:8}.bg{stroke:var(--line,#ebebeb)}.fg{stroke:var(--ink,#0a0a0a);stroke-linecap:round;transition:stroke-dashoffset .9s linear}
.time{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:56px;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.row{display:flex;gap:10px;justify-content:center;margin-top:22px;flex-wrap:wrap}
button{height:48px;border-radius:999px;border:1.5px solid var(--line-2,#dedede);background:var(--surface,#fff);color:var(--ink,#0a0a0a);padding:0 20px;font-weight:800;font-size:16px}
button.pri{background:var(--ink,#0a0a0a);color:var(--on-ink,#fff);border-color:transparent;min-width:120px}
.stat{color:var(--muted,#767676);font-weight:700;margin-top:20px}`;
const POMO_JS = `const zh=nest.context.lang!=='en';const L=zh?{t:'番茄鐘',focus:'專注時間',brk:'休息一下',start:'開始',pause:'暫停',reset:'重設',skip:'跳過',stat:'今天完成 {n} 個番茄',doneF:'專注完成！休息一下吧。',doneB:'休息完畢，繼續加油！'}:{t:'Pomodoro',focus:'Focus time',brk:'Take a break',start:'Start',pause:'Pause',reset:'Reset',skip:'Skip',stat:'{n} pomodoros done today',doneF:'Focus done! Take a break.',doneB:'Break over — back to it!'};
const s=nest.settings||{};const F=(Number(s.focus)||25)*60,B=(Number(s.brk)||5)*60;const $=(i)=>document.getElementById(i);
$('t').textContent=L.t;$('reset').textContent=L.reset;$('skip').textContent=L.skip;
const C=2*Math.PI*52;$('arc').style.strokeDasharray=C;
let phase='focus',left=F,run=false,timer=0,endAt=0,today='',count=0;
const day=()=>new Date(Date.now()+8*3600e3).toISOString().slice(0,10);
function fmt(x){const m=Math.floor(x/60),ss=x%60;return String(m).padStart(2,'0')+':'+String(ss).padStart(2,'0');}
function draw(){const tot=phase==='focus'?F:B;$('time').textContent=fmt(left);$('arc').style.strokeDashoffset=C*(1-left/tot);$('phase').textContent=phase==='focus'?L.focus:L.brk;$('go').textContent=run?L.pause:L.start;$('stat').textContent=L.stat.replace('{n}',count);}
function tick(){left=Math.max(0,Math.round((endAt-Date.now())/1000));if(left<=0){done();}draw();}
function done(){clearInterval(timer);run=false;if(phase==='focus'){count++;nest.storage.set('count',{day:day(),n:count}).catch(()=>{});nest.ui.toast(L.doneF).catch(()=>{});phase='brk';left=B;}else{nest.ui.toast(L.doneB).catch(()=>{});phase='focus';left=F;}if(s.auto){start();}}
function start(){run=true;endAt=Date.now()+left*1000;clearInterval(timer);timer=setInterval(tick,500);draw();}
$('go').onclick=()=>{if(run){run=false;clearInterval(timer);draw();}else start();};
$('reset').onclick=()=>{run=false;clearInterval(timer);left=phase==='focus'?F:B;draw();};
$('skip').onclick=()=>{run=false;clearInterval(timer);phase=phase==='focus'?'brk':'focus';left=phase==='focus'?F:B;draw();};
nest.storage.get('count').then((v)=>{if(v&&v.day===day())count=v.n||0;draw();}).catch(draw);draw();`;

const QUOTE_HTML = `<div class="q"><p id="text"></p><div class="foot"><span id="by"></span><button id="next" aria-label="next">↻</button></div></div>`;
const QUOTE_CSS = `.q{padding:4px 2px 2px}#text{margin:0;font-weight:800;font-size:18px;line-height:1.45;letter-spacing:-.01em}
.foot{display:flex;align-items:center;justify-content:space-between;margin-top:10px;color:var(--muted,#767676);font-weight:700;font-size:13px}
button{width:34px;height:34px;border-radius:999px;border:0;background:var(--soft,#f5f5f5);color:var(--ink,#0a0a0a);font-size:16px;font-weight:900}`;
const QUOTE_JS = `const Q=[["千里之行，始於足下。","老子","A journey of a thousand miles begins with a single step.","Lao Tzu"],["學而不思則罔，思而不學則殆。","孔子","Learning without thought is labour lost; thought without learning is perilous.","Confucius"],["今日事，今日畢。","諺語","Don’t put off till tomorrow what you can do today.","Proverb"],["不積跬步，無以至千里。","荀子","Without small steps, there is no journey of a thousand miles.","Xunzi"],["一寸光陰一寸金。","諺語","An inch of time is an inch of gold.","Proverb"],["你今天的努力，是明天的底氣。","Nest","Today’s effort is tomorrow’s confidence.","Nest"],["家是我們出發的地方。","T. S. Eliot","Home is where one starts from.","T. S. Eliot"],["失敗為成功之母。","諺語","Failure is the mother of success.","Proverb"],["知之為知之，不知為不知，是知也。","孔子","To know what you know and what you do not know — that is true knowledge.","Confucius"],["慢慢來，比較快。","諺語","Slow down to go faster.","Proverb"],["好奇心是學習的開始。","Nest","Curiosity is where learning begins.","Nest"],["世上無難事，只怕有心人。","諺語","Nothing is impossible to a willing heart.","Proverb"]];
const s=nest.settings||{};const lang=s.lang&&s.lang!=='auto'?s.lang:(nest.context.lang==='en'?'en':'zh');
const dayN=Math.floor((Date.now()+8*3600e3)/864e5);let i=dayN%Q.length;
function show(){const q=Q[i];document.getElementById('text').textContent=lang==='en'?q[2]:q[0];document.getElementById('by').textContent='— '+(lang==='en'?q[3]:q[1]);}
document.getElementById('next').onclick=()=>{i=(i+1)%Q.length;show();};show();`;

export const SEEDS = [
  {
    id: 'sky-theme', featured: true, installs: 0, video: '',
    manifest: {
      id: 'sky-theme', name: 'Sky', nameZh: '天空', version: '1.0.0', category: 'theme', icon: '/plugins/sky-theme/icon.svg',
      description: 'A soft sky behind your whole Nest — clear day, warm sunset or a starry night.',
      descriptionZh: '為整個 Nest 換上柔和的天空背景 —— 晴朗白天、溫暖日落或星空夜晚。',
      capabilities: ['theme', 'background'], permissions: [],
      settings: [{ key: 'style', type: 'select', label: 'Sky', labelZh: '天空', default: 'day', options: [{ value: 'day', label: 'Clear day', labelZh: '晴朗白天' }, { value: 'sunset', label: 'Sunset', labelZh: '日落' }, { value: 'night', label: 'Starry night', labelZh: '星空夜晚' }] }],
      theme: { setting: 'style', variants: SKY_VARIANT },
    },
    html: '', css: '', js: '', shots: shots('sky-theme', 3),
  },
  {
    id: 'dark-mode', featured: true, installs: 0, video: '',
    manifest: {
      id: 'dark-mode', name: 'Midnight', nameZh: '深夜模式', version: '1.0.0', category: 'theme', icon: '/plugins/dark-mode/icon.svg',
      description: 'A calm dark mode for late-night revision. Soft grey or true black for OLED screens.',
      descriptionZh: '夜晚溫習更舒服的深色模式。可選柔和深灰或 OLED 純黑。',
      capabilities: ['theme'], permissions: [],
      settings: [{ key: 'tone', type: 'select', label: 'Tone', labelZh: '色調', default: 'soft', options: [{ value: 'soft', label: 'Soft grey', labelZh: '柔和深灰' }, { value: 'black', label: 'True black', labelZh: '純黑' }] }],
      theme: { setting: 'tone', variants: DARK_VARIANT },
    },
    html: '', css: '', js: '', shots: shots('dark-mode', 2),
  },
  {
    id: 'rounded-fonts', featured: false, installs: 0, video: '',
    manifest: {
      id: 'rounded-fonts', name: 'Rounded Fonts', nameZh: '圓體字款', version: '1.0.0', category: 'theme', icon: '/plugins/rounded-fonts/icon.svg',
      description: 'Friendly rounded typefaces for every page. Chinese text stays in Noto Sans TC.',
      descriptionZh: '為每一頁換上親切的圓體英文字款，中文保持思源黑體。',
      capabilities: ['font'], permissions: [],
      settings: [{ key: 'font', type: 'select', label: 'Font', labelZh: '字款', default: 'Quicksand', options: ['Quicksand', 'M PLUS Rounded 1c', 'Varela Round', 'Baloo 2', 'Comfortaa'].map((f) => ({ value: f, label: f })) }],
      theme: { setting: 'font', variants: Object.fromEntries(['Quicksand', 'M PLUS Rounded 1c', 'Varela Round', 'Baloo 2', 'Comfortaa'].map((f) => [f, { font: f, headingFont: f }])) },
    },
    html: '', css: '', js: '', shots: shots('rounded-fonts', 2),
  },
  {
    id: 'countdown', featured: true, installs: 0, video: '',
    manifest: {
      id: 'countdown', name: 'Countdown', nameZh: '倒數', version: '1.0.0', category: 'productivity', icon: '/plugins/countdown/icon.svg',
      description: 'A tab that counts down to exams, trips and birthdays. Optional reminder the day before.',
      descriptionZh: '新增一個分頁，倒數考試、旅行和生日。可選在前一天提醒你。',
      capabilities: ['tab'], permissions: ['reminders.write'],
      tab: { title: 'Countdown', titleZh: '倒數', icon: 'calendar' },
      settings: [{ key: 'title', type: 'text', label: 'Pinned countdown', labelZh: '置頂倒數', default: '', maxLength: 40 }, { key: 'date', type: 'date', label: 'Pinned date', labelZh: '置頂日期', default: '' }],
    },
    html: COUNTDOWN_HTML, css: COUNTDOWN_CSS, js: COUNTDOWN_JS, shots: shots('countdown', 2),
  },
  {
    id: 'pomodoro', featured: true, installs: 0, video: '',
    manifest: {
      id: 'pomodoro', name: 'Pomodoro', nameZh: '番茄鐘', version: '1.0.0', category: 'study', icon: '/plugins/pomodoro/icon.svg',
      description: 'Focus in 25-minute blocks with short breaks. Counts your pomodoros for the day.',
      descriptionZh: '以 25 分鐘為一節專注溫習，中間小休。記錄今天完成了多少個番茄。',
      capabilities: ['tab'], permissions: [],
      tab: { title: 'Focus', titleZh: '番茄鐘', icon: 'gauge' },
      settings: [{ key: 'focus', type: 'number', label: 'Focus minutes', labelZh: '專注分鐘', default: 25, min: 5, max: 90 }, { key: 'brk', type: 'number', label: 'Break minutes', labelZh: '休息分鐘', default: 5, min: 1, max: 30 }, { key: 'auto', type: 'toggle', label: 'Start the next block automatically', labelZh: '自動開始下一節', default: false }],
    },
    html: POMO_HTML, css: POMO_CSS, js: POMO_JS, shots: shots('pomodoro', 2),
  },
  {
    id: 'daily-quote', featured: false, installs: 0, video: '',
    manifest: {
      id: 'daily-quote', name: 'Daily Quote', nameZh: '每日金句', version: '1.0.0', category: 'study', icon: '/plugins/daily-quote/icon.svg',
      description: 'A short, encouraging quote on your Home every day — in Chinese or English.',
      descriptionZh: '每天在主頁顯示一句鼓勵的話，中英文皆可。',
      capabilities: ['widget'], permissions: [],
      widget: { title: 'Daily quote', titleZh: '每日金句', height: 120 },
      settings: [{ key: 'lang', type: 'select', label: 'Language', labelZh: '語言', default: 'auto', options: [{ value: 'auto', label: 'Same as Nest', labelZh: '跟隨 Nest' }, { value: 'zh', label: '中文' }, { value: 'en', label: 'English' }] }],
    },
    html: QUOTE_HTML, css: QUOTE_CSS, js: QUOTE_JS, shots: shots('daily-quote', 2),
  },
];
