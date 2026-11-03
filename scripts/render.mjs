// Turns the saved JSON briefs in data/ into static pages in public/.
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const href = (u) => (/^https?:\/\//i.test(String(u || "")) ? esc(u) : "#");
const shortDate = (iso) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const CSS = `
:root{--bg:#F2F5F7;--surface:#FFFFFF;--ink:#18242D;--muted:#5A6A75;--rule:#D6DEE3;--accent:#1F6E8C;--sun:#B8741F;--sun-soft:#FBEFDD;--up:#2E7D4F;--down:#B4472F;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#0F171C;--surface:#162129;--ink:#E4ECF1;--muted:#97A8B3;--rule:#26343D;--accent:#79B8D3;--sun:#E7AE63;--sun-soft:#2A2117;--up:#6CC490;--down:#EE8A72;color-scheme:dark}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.65 "Literata",Georgia,"Times New Roman",serif;padding:env(safe-area-inset-top,0) 0 env(safe-area-inset-bottom,0)}
.wrap{max-width:46rem;margin:0 auto;padding:1.5rem 1.25rem 4rem}
a{color:var(--accent);text-underline-offset:.18em;text-decoration-thickness:1px}
a:hover{text-decoration-thickness:2px}
a:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:2px}
h1,h2,h3,.brand,.jump,.hl b,.snap,.src{font-family:"Bricolage Grotesque",system-ui,-apple-system,"Segoe UI",sans-serif}
.top{display:flex;justify-content:space-between;align-items:baseline;gap:1rem;flex-wrap:wrap;border-bottom:1px solid var(--rule);padding-bottom:.75rem}
.brand{font-weight:700;font-size:1.15rem;color:var(--ink);text-decoration:none}
.nav{display:flex;gap:1rem;font-size:.95rem}
.when{color:var(--muted);font-size:.95rem;margin:1.5rem 0 .25rem}
h1{font-size:clamp(1.6rem,4.5vw,2.3rem);line-height:1.2;font-weight:650;letter-spacing:-.01em;margin:0 0 1.5rem}
.hl{display:grid;grid-template-columns:repeat(3,1fr);gap:1.25rem;margin:0 0 2rem;padding:0;list-style:none}
.hl li{border-top:3px solid var(--accent);padding-top:.6rem;font-size:.95rem;line-height:1.5}
.hl b{display:block;font-size:1rem;margin-bottom:.2rem}
.morning{background:var(--sun-soft);border-left:4px solid var(--sun);padding:1.4rem 1.5rem;margin:0 0 2rem;border-radius:0 10px 10px 0}
.morning h2{font-size:1rem;color:var(--sun);margin:0 0 .75rem;font-weight:650}
.morning blockquote{margin:0 0 1rem;font-size:1.35rem;line-height:1.45;font-style:italic}
.morning cite{display:block;font-style:normal;font-size:.95rem;color:var(--muted);margin-top:.4rem}
.morning h3{font-size:1.05rem;margin:0 0 .25rem}
.morning p{margin:0}
.jump{display:flex;flex-wrap:wrap;gap:.4rem;margin:0 0 2rem;padding:0;list-style:none;font-size:.85rem}
.jump a{display:block;padding:.3rem .65rem;border:1px solid var(--rule);border-radius:999px;text-decoration:none;color:var(--ink);background:var(--surface)}
.jump a:hover{border-color:var(--accent)}
section.s{margin:0 0 2.5rem;scroll-margin-top:1rem}
section.s h2{font-size:1.35rem;font-weight:650;margin:0 0 .75rem;padding-bottom:.4rem;border-bottom:1px solid var(--rule)}
ol.items{margin:0;padding-left:1.4rem}
ol.items li{margin:0 0 1.1rem;padding-left:.25rem}
ol.items li::marker{color:var(--muted);font-family:"Bricolage Grotesque",system-ui,sans-serif}
ol.items a{font-weight:600}
.src{color:var(--muted);font-size:.8rem;margin-left:.4rem}
ol.items p{margin:.2rem 0 0}
.snap{display:flex;flex-wrap:wrap;gap:.6rem;margin:0 0 1rem;padding:0;list-style:none}
.snap li{background:var(--surface);border:1px solid var(--rule);border-radius:8px;padding:.45rem .75rem;font-size:.9rem}
.snap .v{font-weight:650;margin:0 .35rem}
.up{color:var(--up)}.down{color:var(--down)}
.status{display:flex;gap:.6rem;align-items:baseline;margin:0 0 1rem}
.dot{width:.7rem;height:.7rem;border-radius:50%;flex:none;transform:translateY(.05rem);background:var(--muted)}
.st-clear .dot{background:var(--up)}.st-issues .dot{background:var(--down)}
.empty{color:var(--muted);font-style:italic}
.archive{list-style:none;padding:0;margin:1.5rem 0}
.archive li{padding:.75rem 0;border-bottom:1px solid var(--rule)}
.archive a{font-family:"Bricolage Grotesque",system-ui,sans-serif;font-weight:600}
.archive p{margin:.15rem 0 0;color:var(--muted);font-size:.95rem}
footer.f{border-top:1px solid var(--rule);margin-top:3rem;padding-top:1rem;color:var(--muted);font-size:.85rem}
@media (max-width:640px){.hl{grid-template-columns:1fr;gap:.9rem}body{font-size:16px}.morning blockquote{font-size:1.2rem}}
`;

function layout({ site, title, description, body }) {
  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌅</text></svg>">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,650;12..96,700&family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;1,7..72,400&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body><div class="wrap">
${body}
<footer class="f">${esc(site.footer)}</footer>
</div></body></html>`;
}

function topBar(site, { prev, next }) {
  const links = [
    prev ? `<a href="/${prev}/">← ${esc(shortDate(prev))}</a>` : "",
    next ? `<a href="/${next}/">${esc(shortDate(next))} →</a>` : "",
    `<a href="/archive/">Archive</a>`,
  ].join("");
  return `<header class="top"><a class="brand" href="/">${esc(site.title)}</a><nav class="nav">${links}</nav></header>`;
}

const changeClass = (c) => (/^\s*[-−]/.test(c || "") ? "down" : /^\s*\+/.test(c || "") ? "up" : "");

function items(list) {
  if (!list?.length) return "";
  return `<ol class="items">${list
    .map((i) => `<li><a href="${href(i.url)}" rel="noopener">${esc(i.title)}</a>${i.source ? `<span class="src">${esc(i.source)}</span>` : ""}<p>${esc(i.summary)}</p></li>`)
    .join("")}</ol>`;
}

function sectionHtml(def, data) {
  const heading = `${def.emoji ? `${def.emoji} ` : ""}${esc(def.title)}`;
  if (!data?.ok) {
    return `<section class="s" id="${def.id}"><h2>${heading}</h2><p class="empty">This section couldn’t be updated today. It will try again tomorrow.</p></section>`;
  }
  let inner = "";
  if (def.type === "market" && data.snapshot?.length) {
    inner += `<ul class="snap">${data.snapshot
      .map((s) => `<li>${esc(s.label)}<span class="v">${esc(s.value)}</span><span class="${changeClass(s.change)}">${esc(s.change)}</span></li>`)
      .join("")}</ul>`;
  }
  if (def.type === "status") {
    const label = { clear: "No major issues found", issues: "Issues reported", unknown: "Status unclear" }[data.status];
    inner += `<p class="status st-${data.status}"><span class="dot" aria-hidden="true"></span><span><strong>${label}.</strong> ${esc(data.statusNote)}</span></p>`;
  }
  inner += items(data.items);
  return `<section class="s" id="${def.id}"><h2>${heading}</h2>${inner}</section>`;
}

function dayPage(site, defs, brief, nav) {
  const health = brief.sections?.health;
  const healthDef = defs.find((d) => d.type === "health");
  const morning =
    healthDef && health?.ok
      ? `<section class="morning" id="${healthDef.id}"><h2>${healthDef.emoji ? `${healthDef.emoji} ` : ""}${esc(healthDef.title)}</h2>
<blockquote>“${esc(health.quote.text)}”<cite>${esc(health.quote.author)}</cite></blockquote>
<h3>${esc(health.tip.title)}</h3><p>${esc(health.tip.body)}</p></section>`
      : "";
  const others = defs.filter((d) => d.type !== "health");
  const jump = `<ul class="jump">${others.map((d) => `<li><a href="#${d.id}">${esc(d.title)}</a></li>`).join("")}</ul>`;
  const hl = brief.highlights?.length
    ? `<ul class="hl">${brief.highlights.map((h) => `<li><b>${esc(h.label)}</b>${esc(h.text)}</li>`).join("")}</ul>`
    : "";
  const body = `${topBar(site, nav)}
<p class="when">${esc(brief.longDate)}, ${esc(brief.clock)}</p>
<h1>${esc(brief.headline)}</h1>
${hl}${morning}${jump}
${others.map((d) => sectionHtml(d, brief.sections?.[d.id])).join("\n")}`;
  return layout({ site, title: `${site.title}, ${brief.longDate}`, description: brief.headline, body });
}

function archivePage(site, briefs) {
  const list = [...briefs]
    .reverse()
    .map((b) => `<li><a href="/${b.date}/">${esc(b.longDate)}</a><p>${esc(b.headline)}</p></li>`)
    .join("");
  const body = `${topBar(site, {})}<h1 style="margin-top:1.5rem">Archive</h1><ul class="archive">${list || "<li>No briefs yet.</li>"}</ul>`;
  return layout({ site, title: `${site.title} archive`, description: "Every past morning brief.", body });
}

async function put(file, html) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, html);
}

export async function renderAll({ root, dataDir, site, sections }) {
  const out = path.join(root, "public");
  let files = [];
  try {
    files = (await readdir(dataDir)).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  } catch {}
  const briefs = await Promise.all(files.map(async (f) => JSON.parse(await readFile(path.join(dataDir, f), "utf8"))));

  for (let i = 0; i < briefs.length; i++) {
    const html = dayPage(site, sections, briefs[i], { prev: briefs[i - 1]?.date, next: briefs[i + 1]?.date });
    await put(path.join(out, briefs[i].date, "index.html"), html);
    if (i === briefs.length - 1) await put(path.join(out, "index.html"), html);
  }
  await put(path.join(out, "archive", "index.html"), archivePage(site, briefs));
  return briefs.length;
}
