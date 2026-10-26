// Safe maths expression parser for ```nest-ui``` plots. NO eval / Function / with: a tokenizer + recursive-descent
// parser builds a small tree that is evaluated by walking it. Only numbers, a fixed set of functions and constants,
// and the variables the caller allows (x, t, slider names) are accepted; anything else is a parse error.
// compile(src, vars) → { ok:true, fn(scope) → number, vars:[used] } | { ok:false, error }
const FUNCS = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, exp: Math.exp, ln: Math.log, log: Math.log10, log2: Math.log2,
  floor: Math.floor, ceil: Math.ceil, round: Math.round, sign: Math.sign,
  min: Math.min, max: Math.max, pow: Math.pow, atan2: Math.atan2,
  // degrees helpers (school physics writes angles in degrees)
  sind: (d) => Math.sin((d * Math.PI) / 180), cosd: (d) => Math.cos((d * Math.PI) / 180), tand: (d) => Math.tan((d * Math.PI) / 180),
};
const ARITY = { min: [1, 8], max: [1, 8], pow: [2, 2], atan2: [2, 2] };
const CONSTS = { pi: Math.PI, 'π': Math.PI, e: Math.E, deg: Math.PI / 180 };
export const MAX_LEN = 240;
const MAX_NODES = 400;
const MAX_DEPTH = 40;

function tokenize(src) {
  const s = String(src).replace(/[×·]/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-').replace(/\*\*/g, '^');
  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    const num = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(s.slice(i));
    if (num) { out.push({ t: 'num', v: parseFloat(num[0]) }); i += num[0].length; continue; }
    const id = /^([A-Za-z_\u0370-\u03ff][A-Za-z0-9_\u0370-\u03ff]*)/.exec(s.slice(i));
    if (id) { out.push({ t: 'id', v: id[1] }); i += id[1].length; continue; }
    if ('+-*/^(),'.includes(c)) { out.push({ t: c }); i++; continue; }
    throw new Error(`bad character "${c}"`);
  }
  return out;
}

// Grammar: expr := term (('+'|'-') term)* ; term := unary (('*'|'/'|implicit) unary)* ;
// unary := '-' unary | '+' unary | power ; power := atom ('^' unary)? ; atom := num | const | var | func '(' args ')' | '(' expr ')'
export function parse(src, allowed = ['x']) {
  if (typeof src !== 'string' || !src.trim()) throw new Error('empty');
  if (src.length > MAX_LEN) throw new Error('too long');
  const toks = tokenize(src);
  let p = 0; let nodes = 0;
  const vars = new Set();
  const allow = new Set(allowed);
  const peek = () => toks[p];
  const take = (t) => { const k = toks[p]; if (!k || (t && k.t !== t)) throw new Error(`expected ${t || 'token'}`); p++; return k; };
  const node = (n) => { if (++nodes > MAX_NODES) throw new Error('too complex'); return n; };
  const startsAtom = (k) => k && (k.t === 'num' || k.t === 'id' || k.t === '(');
  const expr = (d) => {
    if (d > MAX_DEPTH) throw new Error('too deep');
    let a = term(d + 1);
    while (peek() && (peek().t === '+' || peek().t === '-')) { const op = take().t; a = node({ op, a, b: term(d + 1) }); }
    return a;
  };
  const term = (d) => {
    let a = unary(d + 1);
    for (;;) {
      const k = peek();
      if (k && (k.t === '*' || k.t === '/')) { take(); a = node({ op: k.t, a, b: unary(d + 1) }); continue; }
      if (startsAtom(k)) { a = node({ op: '*', a, b: power(d + 1) }); continue; } // implicit: 2x, 3(x+1), (a)(b)
      return a;
    }
  };
  const unary = (d) => {
    if (d > MAX_DEPTH) throw new Error('too deep');
    const k = peek();
    if (k && k.t === '-') { take(); return node({ op: 'neg', a: unary(d + 1) }); }
    if (k && k.t === '+') { take(); return unary(d + 1); }
    return power(d + 1);
  };
  const power = (d) => {
    const a = atom(d + 1);
    if (peek() && peek().t === '^') { take(); return node({ op: '^', a, b: unary(d + 1) }); }
    return a;
  };
  const atom = (d) => {
    if (d > MAX_DEPTH) throw new Error('too deep');
    const k = take();
    if (k.t === 'num') return node({ op: 'num', v: k.v });
    if (k.t === '(') { const e = expr(d + 1); take(')'); return e; }
    if (k.t === 'id') {
      const name = k.v;
      if (peek() && peek().t === '(' && Object.prototype.hasOwnProperty.call(FUNCS, name)) {
        take('(');
        const args = [expr(d + 1)];
        while (peek() && peek().t === ',') { take(); args.push(expr(d + 1)); }
        take(')');
        const [lo, hi] = ARITY[name] || [1, 1];
        if (args.length < lo || args.length > hi) throw new Error(`${name} takes ${lo === hi ? lo : `${lo}-${hi}`} argument(s)`);
        return node({ op: 'call', f: name, args });
      }
      if (allow.has(name)) { vars.add(name); return node({ op: 'var', v: name }); }
      if (Object.prototype.hasOwnProperty.call(CONSTS, name)) return node({ op: 'num', v: CONSTS[name] });
      throw new Error(`unknown name "${name}"`);
    }
    throw new Error(`unexpected "${k.t}"`);
  };
  const tree = expr(0);
  if (p !== toks.length) throw new Error(`unexpected "${toks[p].t === 'id' || toks[p].t === 'num' ? toks[p].v : toks[p].t}"`);
  return { tree, vars: [...vars] };
}

function ev(n, sc) {
  switch (n.op) {
    case 'num': return n.v;
    case 'var': return +sc[n.v];
    case 'neg': return -ev(n.a, sc);
    case '+': return ev(n.a, sc) + ev(n.b, sc);
    case '-': return ev(n.a, sc) - ev(n.b, sc);
    case '*': return ev(n.a, sc) * ev(n.b, sc);
    case '/': return ev(n.a, sc) / ev(n.b, sc);
    case '^': return Math.pow(ev(n.a, sc), ev(n.b, sc));
    case 'call': return FUNCS[n.f](...n.args.map((a) => ev(a, sc)));
    default: return NaN;
  }
}

export function compile(src, allowed = ['x']) {
  try {
    const { tree, vars } = parse(src, allowed);
    return { ok: true, vars, fn: (scope = {}) => { const v = ev(tree, scope); return Number.isFinite(v) ? v : NaN; } };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}
