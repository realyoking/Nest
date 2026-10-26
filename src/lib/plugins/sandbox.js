// Builds the srcdoc for a plugin iframe. The iframe is ALWAYS rendered with sandbox="allow-scripts" and never
// allow-same-origin, so the document has an opaque origin: no access to Nest's cookies, localStorage, IndexedDB,
// Firebase tokens or DOM. The CSP below is the first element of <head>, before any plugin markup:
//   no fetch/XHR/WebSocket (connect-src 'none'), no frames, no workers, no forms, no plugins, no <base>;
//   images only from data:/blob: and Nest's own origin; fonts only from Google Fonts.
// Top navigation, popups and modals are blocked by the sandbox flags (not granted).
import { SITE } from '../../site.js';
export const SANDBOX_FLAGS = 'allow-scripts';

// domains: the plugin's declared network domains — only when the user granted `network` (re-validated here).
const DOM = /^(\*\.)?([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;
export function cspFor(origin = SITE, domains = []) {
  const self = /^https:\/\/[a-z0-9.-]+$/.test(origin) ? origin : SITE;
  const net = (Array.isArray(domains) ? domains : []).filter((d) => DOM.test(String(d))).slice(0, 10).map((d) => `https://${d}`).join(' ');
  return [
    "default-src 'none'",
    "script-src 'unsafe-inline'",
    "style-src 'unsafe-inline' https://fonts.googleapis.com",
    'font-src https://fonts.gstatic.com data:',
    `img-src data: blob: ${self}${net ? ` ${net}` : ''}`,
    'media-src data: blob:',
    net ? `connect-src ${net}` : "connect-src 'none'", "frame-src 'none'", "child-src 'none'", "worker-src 'none'", "object-src 'none'",
    "form-action 'none'", "base-uri 'none'", "manifest-src 'none'",
  ].join('; ');
}

const jsonForScript = (v) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
// Plugin CSS / JS go inside <style> / <script>; neutralise any closing tag so they cannot break out of the element.
const safeCss = (c) => String(c || '').replace(/<\/(style)/gi, '<\\/$1');
const safeJs = (c) => String(c || '').replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');

// The plugin-side SDK (window.nest). Runs inside the sandbox only.
const SDK = `(function(){
var CH=__CH__,CTX=__CTX__,seq=0,pend={},subs={};
function call(m,p){return new Promise(function(res,rej){var id=++seq;pend[id]={res:res,rej:rej};
parent.postMessage({nest:1,ch:CH,id:id,method:m,params:p===undefined?{}:p},'*');
setTimeout(function(){if(pend[id]){delete pend[id];rej(new Error('timeout'));}},/^(ai[.]ask|media[.]pickPhoto|gmail[.]summary|classroom[.]list|calendar[.]create|calendar[.]delete|memory[.]add|links[.]open)$/.test(m)?120000:15000);});}
addEventListener('message',function(e){if(e.source!==parent)return;var d=e.data;if(!d||d.nest!==1||d.ch!==CH)return;
if(d.event){(subs[d.event]||[]).forEach(function(f){try{f(d.data)}catch(x){}});return;}
var p=pend[d.id];if(!p)return;delete pend[d.id];if(d.ok)p.res(d.result);else p.rej(new Error(d.error||'error'));});
var api={context:CTX,settings:CTX.settings,
on:function(ev,f){(subs[ev]=subs[ev]||[]).push(f);},
theme:{set:function(t){return call('theme.set',t)},reset:function(){return call('theme.reset')}},
ui:{resize:function(h){return call('ui.resize',{height:h})},toast:function(t){return call('ui.toast',{text:String(t)})},addTab:function(o){return call('ui.addTab',o||{})}},
storage:{get:function(k){return call('storage.get',{key:k})},set:function(k,v){return call('storage.set',{key:k,value:v})},remove:function(k){return call('storage.remove',{key:k})},keys:function(){return call('storage.keys')}},
reminders:{list:function(){return call('reminders.list')},create:function(o){return call('reminders.create',o)},update:function(id,f){return call('reminders.update',{id:id,fields:f})},remove:function(id){return call('reminders.delete',{id:id})}},
calendar:{list:function(o){return call('calendar.list',o||{})},create:function(o){return call('calendar.create',o)},update:function(id,f){return call('calendar.update',{id:id,fields:f})},remove:function(id){return call('calendar.delete',{id:id})}},
members:{list:function(){return call('members.list')}},
memory:{list:function(o){return call('memory.list',o||{})},add:function(o){return call('memory.add',typeof o==='string'?{text:o}:o)}},
study:{list:function(o){return call('study.list',o||{})}},notices:{list:function(o){return call('notices.list',o||{})}},bills:{list:function(o){return call('bills.list',o||{})}},
weather:{get:function(){return call('weather.get')}},transport:{get:function(){return call('transport.get')}},
gmail:{summary:function(o){return call('gmail.summary',o||{})}},classroom:{list:function(o){return call('classroom.list',o||{})}},
ai:{ask:function(p){return call('ai.ask',{prompt:String(p)})}},
media:{pickPhoto:function(o){return call('media.pickPhoto',o||{})}},location:{get:function(){return call('location.get')}},
clipboard:{write:function(t){return call('clipboard.write',{text:String(t)})}},links:{open:function(u){return call('links.open',{url:String(u)})}},
notify:{show:function(o){return call('notify.show',o)}},
getSettings:function(){return call('settings.get')}};
try{Object.keys(api).forEach(function(k){if(api[k]&&typeof api[k]==='object')Object.freeze(api[k]);});}catch(x){}
Object.defineProperty(window,'nest',{value:Object.freeze(api),writable:false,configurable:false});
if(CTX.surface!=='background'&&window.ResizeObserver){var last=0,t=0;var ro=new ResizeObserver(function(){clearTimeout(t);t=setTimeout(function(){
var h=Math.ceil(document.documentElement.scrollHeight);if(Math.abs(h-last)>2){last=h;call('ui.resize',{height:h}).catch(function(){});}},60);});
addEventListener('DOMContentLoaded',function(){ro.observe(document.documentElement);});}
})();`;

// vars: the app's current CSS variables (so a widget matches the Nest theme).
export function buildSrcdoc({ html = '', css = '', js = '' }, { channel, context = {}, vars = {}, origin, domains = [] } = {}) {
  const varCss = Object.entries(vars).filter(([k, v]) => /^--[a-z0-9-]+$/.test(k) && /^[#(),.%\w\s'-]+$/.test(String(v))).map(([k, v]) => `${k}:${v};`).join('');
  const sdk = SDK.replace('__CH__', () => jsonForScript(String(channel || ''))).replace('__CTX__', () => jsonForScript(context));
  return `<!doctype html><html lang="${context.lang === 'en' ? 'en' : 'zh-Hant'}"><head>`
    + `<meta http-equiv="Content-Security-Policy" content="${cspFor(origin, domains)}">`
    + '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Noto+Sans+TC:wght@400;500;700;900&display=swap">'
    + `<style>:root{${varCss}color-scheme:${context.scheme === 'dark' ? 'dark' : 'light'}}`
    + "html,body{margin:0;background:transparent;color:var(--ink,#0a0a0a);font-family:var(--font,'Nunito','Noto Sans TC',sans-serif);-webkit-font-smoothing:antialiased}"
    + '*{box-sizing:border-box}button{font:inherit;cursor:pointer}</style>'
    + `<style>${safeCss(css)}</style>`
    + `<script>${sdk}</script>`
    + `</head><body>${String(html || '')}<script>${safeJs(js)}</script></body></html>`;
}
