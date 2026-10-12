// Met à jour le bloc "Activité" du README entre <!--ACTIVITY:start--> et <!--ACTIVITY:end-->.
// Source : événements publics GitHub (toutes branches, pas seulement main) + recherche de commits co-signés Claude.
const fs = require('fs');
const USER = 'ManuYao';
const H = { 'User-Agent': 'profile-readme', Accept: 'application/vnd.github+json', ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) };
const get = async (u) => { const r = await fetch(u, { headers: H }); if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); };
const day = (d) => d.toISOString().slice(0, 10);
const badge = (label, value, color) => `<img src="https://img.shields.io/badge/${encodeURIComponent(label).replace(/-/g, '--')}-${encodeURIComponent(String(value)).replace(/-/g, '--')}-${color}?style=for-the-badge" alt="${label}" />`;

(async () => {
  let events = [];
  for (let p = 1; p <= 3; p++) { const e = await get(`https://api.github.com/users/${USER}/events/public?per_page=100&page=${p}`); events = events.concat(e); if (e.length < 100) break; }
  const pushes = events.filter((e) => e.type === 'PushEvent');
  const now = Date.now();
  const since = (d) => pushes.filter((e) => now - new Date(e.created_at) < d * 864e5);
  // L'API d'événements ne donne plus le nombre de commits : on le lit par comparaison avant/après chaque push.
  const count = new Map();
  for (const e of since(30)) {
    let n = e.payload.distinct_size ?? e.payload.size;
    if (n == null) {
      try { n = (await get(`https://api.github.com/repos/${e.repo.name}/compare/${e.payload.before}...${e.payload.head}`)).total_commits; } catch { n = 1; }
    }
    count.set(e.id, n);
  }
  const commits = (a) => a.reduce((s, e) => s + (count.get(e.id) || 0), 0);
  const w = since(7), m = since(30);
  const activeDays = new Set(m.map((e) => day(new Date(e.created_at)))).size;
  const repos = new Set(m.map((e) => e.repo.name.split('/')[1]));
  const last = pushes[0] ? new Date(pushes[0].created_at) : null;
  const ago = last ? (() => { const h = Math.floor((now - last) / 36e5); return h < 1 ? "à l'instant" : h < 24 ? `il y a ${h} h` : `il y a ${Math.floor(h / 24)} j`; })() : '—';
  const claude = (await get(`https://api.github.com/search/commits?q=author:${USER}+%22Co-Authored-By:+Claude%22&per_page=1`)).total_count;
  const claude30 = (await get(`https://api.github.com/search/commits?q=author:${USER}+%22Co-Authored-By:+Claude%22+committer-date:%3E${day(new Date(now - 30 * 864e5))}&per_page=1`)).total_count;

  const block = [
    '<!--ACTIVITY:start-->',
    '<p align="left">',
    badge('Dernier push', ago, '1FC777'),
    badge('Commits 7 jours', commits(w), 'D97757'),
    badge('Commits 30 jours', commits(m), 'D97757'),
    badge('Jours actifs (30 j)', activeDays, '0e75b6'),
    '</p>',
    '<p align="left">',
    badge('Co-signés Claude (total)', claude, 'D97757'),
    badge('Co-signés Claude (30 j)', claude30, 'D97757'),
    badge('Projets actifs (30 j)', repos.size, '9575FF'),
    '</p>',
    `<p align="left"><sub>Mis à jour automatiquement le ${day(new Date())} · toutes branches confondues</sub></p>`,
    '<!--ACTIVITY:end-->',
  ].join('\n');

  const f = 'README.md';
  const s = fs.readFileSync(f, 'utf8');
  const re = /<!--ACTIVITY:start-->[\s\S]*<!--ACTIVITY:end-->/;
  if (!re.test(s)) throw new Error('marqueurs absents');
  fs.writeFileSync(f, s.replace(re, block));
  console.log({ w: commits(w), m: commits(m), activeDays, repos: [...repos], ago, claude, claude30 });
})().catch((e) => { console.error(e); process.exit(1); });
