// Pure GitHub agent helpers (Run 13): action types, validation, notes for the model. No imports → unit-testable in node.
// Agent action types → server tools. Reads run straight away (like connected.read); writes always show a confirm card.
export const GH_READ = { 'github.repos': 'repos.list', 'github.search': 'repos.search', 'github.read': 'file.read', 'github.tree': 'tree.list', 'github.branches': 'branches.list' };
export const GH_WRITE = { 'github.createRepo': 'repo.create', 'github.putFile': 'file.put', 'github.commit': 'files.commit', 'github.branch': 'branch.create', 'github.pr': 'pr.create', 'github.pages': 'pages.enable' };
export const GH_TYPES = [...Object.keys(GH_READ), ...Object.keys(GH_WRITE)];
const REPO_RE = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/;
export function validGithubAction(a) {
  const repo = () => REPO_RE.test(String(a.repo || ''));
  switch (a.type) {
    case 'github.repos': return true;
    case 'github.search': return typeof a.q === 'string' && a.q.trim().length > 0;
    case 'github.read': return repo() && typeof a.path === 'string' && a.path.length > 0;
    case 'github.tree': case 'github.branches': case 'github.pages': return repo();
    case 'github.createRepo': return /^[A-Za-z0-9._-]{1,100}$/.test(String(a.name || ''));
    case 'github.putFile': return repo() && typeof a.path === 'string' && a.path && typeof a.content === 'string';
    case 'github.commit': return repo() && Array.isArray(a.files) && a.files.length > 0 && a.files.length <= 60 && a.files.every((f) => f && typeof f.path === 'string' && typeof f.content === 'string');
    case 'github.branch': return repo() && typeof a.name === 'string' && a.name.length > 0;
    case 'github.pr': return repo() && typeof a.head === 'string' && typeof a.base === 'string';
    default: return false;
  }
}
export function githubArgs(a) {
  const { type, ...rest } = a; // eslint-disable-line no-unused-vars
  return rest;
}
// Short text the model sees on the next turn (results of read actions; never tokens).
export function githubNote(a, result) {
  if (!result) return '';
  if (result.repos) return `repos: ${result.repos.slice(0, 30).map((r) => `${r.full_name}${r.private ? ' (private)' : ''}`).join(', ')}`;
  if (result.entries) return `${a.repo}/${a.path || ''}: ${result.entries.slice(0, 80).map((e) => `${e.path}${e.type === 'dir' ? '/' : ''}`).join(', ')}`;
  if (result.dir) return `${a.repo}/${a.path}: ${result.dir.slice(0, 80).map((e) => `${e.path}${e.type === 'dir' ? '/' : ''}`).join(', ')}`;
  if (result.branches) return `branches of ${a.repo}: ${result.branches.slice(0, 50).join(', ')}`;
  if (typeof result.content === 'string') return `file ${a.repo}/${result.path} (${result.size} bytes):\n${result.content.slice(0, 4000)}${result.content.length > 4000 ? '\n…(truncated)' : ''}`;
  if (result.tooLarge) return `file ${a.repo}/${result.path} is too large to read here (${result.size} bytes)`;
  if (result.html_url) return `result: ${result.html_url}`;
  return '';
}

// Reads run straight away; every GitHub write ALWAYS shows a confirm card, whatever the autonomy setting.
export const ghNeedsConfirm = (a) => !!a && Object.prototype.hasOwnProperty.call(GH_WRITE, a.type);
export const ghIsRead = (a) => !!a && Object.prototype.hasOwnProperty.call(GH_READ, a.type);
