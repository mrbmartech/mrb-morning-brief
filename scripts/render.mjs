// Turns the saved JSON briefs in data/ into static pages in public/.
// Broadsheet newspaper design.
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const href = (u) => (/^https?:\/\//i.test(String(u || "")) ? esc(u) : "#");
const shortDate = (iso) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

// "Hello Mr. Bhaskar (MrB)" → greeting "Hello Mr. Bhaskar", monogram "MrB"
function brandParts(site) {
  const m = String(site.title).match(/^(.*?)\s*\(([^)]{1,6})\)\s*$/);
  const greeting = m ? m[1] : site.title;
  const mono = m ? m[2] : "";
  const masthead = site.masthead || (mono ? `The ${mono} Morning Brief` : "The Morning Brief");
  return { greeting, mono, masthead };
}

function cleanHeadline(h) {
  const s = String(h || "").replace(/^good morning[,!]?\s*(mr\.?\s*\w+)?\s*[—–\-:,]\s*/i, "").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : "";
}

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,700;1,6..72,400;1,6..72,500&family=Libre+Franklin:wght@400;500;600;700&family=UnifrakturMaguntia&display=swap" rel="stylesheet">`;

const CSS = `
:root{
  --desk:#E6E9E3; --paper:#FBFBF8; --ink:#16181A; --body:#34383C; --muted:#5E6469; --hair:#DCDFD8; --rule:#16181A;
  --link:#2F5F86; --up:#0A7A3E; --down:#C3201F; --tint:#F0F2EC; --accent:#7A1F2B;
  --head:"Newsreader","Iowan Old Style","Times New Roman",Georgia,serif;
  --text:"Newsreader","Iowan Old Style",Georgia,serif;
  --sans:"Libre Franklin","Franklin Gothic Medium","Helvetica Neue",Arial,sans-serif;
  --black:"UnifrakturMaguntia","Old English Text MT",Georgia,serif;
  color-scheme:light;
}
@media (prefers-color-scheme:dark){:root{
  --desk:#0D0F10; --paper:#17191B; --ink:#ECEDEA; --body:#D0D3CF; --muted:#9EA4A8; --hair:#2C3033; --rule:#ECEDEA;
  --link:#86B6DE; --up:#5CC48A; --down:#F0716F; --tint:#1E2124; --accent:#E08A95; color-scheme:dark;
}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--desk);color:var(--ink);font:400 17px/1.55 var(--text);padding-bottom:env(safe-area-inset-bottom,0);font-optical-sizing:auto}
a{color:inherit;text-decoration:none}
a:hover{color:var(--muted)}
a:focus-visible{outline:2px solid var(--link);outline-offset:2px}
.page{max-width:80rem;margin:1.5rem auto;padding:0 2.25rem;background:var(--paper);box-shadow:0 1px 2px rgba(20,24,28,.06),0 12px 40px -12px rgba(20,24,28,.18)}

/* Masthead */
.top{display:grid;grid-template-columns:1fr auto 1fr;align-items:end;gap:1rem;padding:calc(env(safe-area-inset-top,0px) + 1rem) 0 .4rem;font:500 .78rem/1.4 var(--sans)}
.top .date{font-weight:700}
.top .date span{display:block;font-weight:400;color:var(--muted)}
.top .hello{text-align:center;font:italic 400 .95rem/1.3 var(--head);color:var(--body)}
.top .days{display:flex;gap:.9rem;justify-content:flex-end}
.top .days a:hover{text-decoration:underline}
.mast{text-align:center;margin:.2rem 0 .9rem}
.mast a{font:400 clamp(2.4rem,6.6vw,4.6rem)/1 var(--black);color:var(--ink);letter-spacing:.005em}
.secbar{border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);position:relative;margin-bottom:3px}
.secbar::after{content:"";position:absolute;left:0;right:0;bottom:-4px;border-bottom:1px solid var(--rule)}
.secbar ul{list-style:none;margin:0;padding:.55rem 0;display:flex;justify-content:center;flex-wrap:wrap;gap:.35rem 1.4rem;font:500 .8rem/1.3 var(--sans)}
.secbar a:hover{text-decoration:underline}

/* Front page */
.front{display:grid;grid-template-columns:minmax(0,1.75fr) minmax(0,1fr) minmax(0,.95fr);margin-top:1.4rem;border-bottom:1px solid var(--rule)}
.front>*{padding:0 1.4rem 1.6rem;border-left:1px solid var(--hair)}
.front>*:first-child{padding-left:0;border-left:0}
.front>*:last-child{padding-right:0}
.kicker{font:700 .74rem/1.3 var(--sans);margin:0 0 .5rem;color:var(--accent)}
.top-story h1{font:700 clamp(1.9rem,3.5vw,2.8rem)/1.08 var(--head);margin:0 0 1.1rem;letter-spacing:-.018em;text-wrap:balance}
.bullets{margin:0;padding-left:1.1rem;color:var(--body)}
.bullets li{margin:0 0 .65rem;font-size:1rem;line-height:1.45}
.bullets li::marker{color:var(--muted)}
.bullets b{font:700 .95rem/1.3 var(--head);color:var(--ink)}
.stamp{margin:1rem 0 0;font:400 .75rem/1.3 var(--sans);color:var(--muted)}

.box h2{font:700 .72rem/1.3 var(--sans);margin:0 0 .6rem}
.box+.box{margin-top:1.4rem;padding-top:1.2rem;border-top:1px solid var(--hair)}
.status{display:flex;gap:.5rem;align-items:baseline;font:700 1.05rem/1.3 var(--head);margin:0 0 .35rem}
.status i{width:.55rem;height:.55rem;border-radius:50%;flex:none;background:var(--muted);transform:translateY(-.05rem)}
.status i.clear{background:var(--up)}.status i.issues{background:var(--down)}
.note{margin:0;color:var(--body);font-size:.92rem;line-height:1.45}
.inc{list-style:none;margin:.7rem 0 0;padding:0}
.inc li{padding:.55rem 0;border-top:1px solid var(--hair);font-size:.88rem;line-height:1.4;color:var(--body)}
.inc a{display:block;font:700 .95rem/1.3 var(--head);color:var(--ink);margin-bottom:.15rem}
table.mkt{width:100%;border-collapse:collapse;font:400 .85rem/1.3 var(--sans);font-variant-numeric:tabular-nums}
table.mkt caption{text-align:left;font:700 .78rem/1.3 var(--sans);padding:.2rem 0 .3rem;color:var(--muted)}
table.mkt td{padding:.38rem 0;border-top:1px solid var(--hair)}
table.mkt td:nth-child(2),table.mkt td:nth-child(3){text-align:right;white-space:nowrap}
table.mkt td:nth-child(3){width:4.8rem;font-weight:700}
table.mkt+table.mkt{margin-top:.8rem}
.up{color:var(--up)}.down{color:var(--down)}

.opinion{background:var(--tint)}
.front>.opinion{padding:1.2rem 1.3rem 1.4rem;border-left:0;margin-bottom:1.6rem;align-self:start}
.opinion blockquote{margin:0;font:italic 500 1.4rem/1.32 var(--head);text-wrap:balance}
.opinion cite{display:block;margin:.55rem 0 0;font:500 .8rem/1.3 var(--sans);font-style:normal;color:var(--muted)}
.opinion h3{font:700 1.05rem/1.25 var(--head);margin:1.3rem 0 .3rem;padding-top:1rem;border-top:1px solid var(--hair)}
.opinion h3+p{margin:0;font-size:.95rem;line-height:1.5;color:var(--body)}
.opinion .kicker{margin:0 0 .5rem}

/* Sections */
.sec{margin-top:2.2rem;padding-top:.5rem;border-top:1px solid var(--rule);scroll-margin-top:1rem}
.sec>h2{font:700 1rem/1.3 var(--sans);margin:0 0 1rem;color:var(--accent)}
.sec>h2 a::after{content:" ›";color:var(--muted)}
.grid{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr)}
.grid>*{padding:0 1.4rem;border-left:1px solid var(--hair)}
.grid>*:first-child{padding-left:0;border-left:0}
.grid>*:last-child{padding-right:0}
.lead h3{font:700 clamp(1.45rem,2.4vw,1.85rem)/1.14 var(--head);margin:0 0 .55rem;letter-spacing:-.012em;text-wrap:balance}
.lead p{margin:0;font-size:1.02rem;line-height:1.5;color:var(--body);max-width:60ch}
.src{display:block;margin-top:.6rem;font:500 .72rem/1.3 var(--sans);color:var(--muted)}
.list{list-style:none;margin:0;padding:0}
.list li{padding:.85rem 0;border-top:1px solid var(--hair)}
.list li:first-child{padding-top:0;border-top:0}
.list h3{font:700 1.08rem/1.25 var(--head);margin:0 0 .3rem;letter-spacing:-.005em}
.list p{margin:0;font-size:.9rem;line-height:1.45;color:var(--muted)}
.missing{margin:0;color:var(--muted);font-style:italic}
.lead a:hover,.list a:hover,.inc a:hover{color:var(--muted)}

/* Archive */
.arch{list-style:none;margin:1.5rem 0 0;padding:0;max-width:46rem}
.arch li{padding:1.1rem 0;border-top:1px solid var(--hair)}
.arch .d{font:700 .75rem/1.3 var(--sans);color:var(--muted)}
.arch a{display:block;margin-top:.3rem;font:700 1.3rem/1.25 var(--head)}
.arch-title{font:700 2rem/1.15 var(--head);margin:1.6rem 0 0}

footer.f{margin-top:3rem;padding:1.2rem 0 3rem;border-top:1px solid var(--rule);font:400 .78rem/1.5 var(--sans);color:var(--muted)}
footer.f .fm{font:400 1.5rem/1 var(--black);color:var(--ink);display:block;margin-bottom:.6rem}

@media (max-width:980px){
  .page{margin:0 auto}
  .front>.opinion{margin-bottom:1.6rem}
  .front{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
  .front .top-story{grid-column:1/-1;padding:0 0 1.6rem;border-left:0;border-bottom:1px solid var(--hair);margin-bottom:1.4rem}
  .front .markets{padding-left:0;border-left:0}
}
@media (max-width:680px){
  body{font-size:15px}
  .page{padding:0 1rem;margin:0;box-shadow:none}
  .top{grid-template-columns:1fr auto}
  .top .hello{display:none}
  .mast a{font-size:min(2.35rem,8.4vw);white-space:nowrap}
  .secbar ul{justify-content:flex-start;flex-wrap:nowrap;overflow-x:auto;padding:.55rem .1rem;scrollbar-width:none}
  .secbar ul::-webkit-scrollbar{display:none}
  .secbar li{flex:none}
  .front{grid-template-columns:1fr}
  .front>*{padding:0 0 1.4rem;border-left:0}
  .front>*+*{border-top:1px solid var(--hair);padding-top:1.2rem}
  .front .top-story{margin-bottom:0}
  .grid{grid-template-columns:1fr}
  .grid>*{padding:0;border-left:0}
  .grid .list{margin-top:1rem;padding-top:.9rem;border-top:1px solid var(--hair)}
}
`;

function layout({ site, title, description, body }) {
  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect width=%22100%22 height=%22100%22 rx=%2212%22 fill=%22%23121212%22/><text x=%2250%22 y=%2272%22 font-family=%22Georgia%22 font-weight=%22700%22 font-size=%2266%22 fill=%22white%22 text-anchor=%22middle%22>B</text></svg>">
${FONTS}
<style>${CSS}</style>
</head>
<body><div class="page">
${body}
<footer class="f"><span class="fm">${esc(brandParts(site).masthead)}</span>${esc(site.footer)}</footer>
</div></body></html>`;
}

function header(site, brief, nav, sectionLinks) {
  const { greeting, masthead } = brandParts(site);
  const days = [
    nav.prev ? `<a href="/${nav.prev}/">‹ ${esc(shortDate(nav.prev))}</a>` : "",
    `<a href="/archive/">Archive</a>`,
    nav.next ? `<a href="/${nav.next}/">${esc(shortDate(nav.next))} ›</a>` : "",
  ].join("");
  const dateBlock = brief
    ? `<div class="date">${esc(brief.longDate)}${brief.clock ? `<span>Prepared ${esc(brief.clock)}</span>` : ""}</div>`
    : `<div class="date"></div>`;
  const bar = sectionLinks?.length
    ? `<nav class="secbar" aria-label="Sections"><ul>${sectionLinks.map((d) => `<li><a href="#${d.id}">${esc(d.title)}</a></li>`).join("")}</ul></nav>`
    : `<div class="secbar"><ul><li>&nbsp;</li></ul></div>`;
  return `<header>
<div class="top">${dateBlock}<div class="hello">${esc(greeting)}</div><nav class="days" aria-label="Other days">${days}</nav></div>
<div class="mast"><a href="/">${esc(masthead)}</a></div>
${bar}
</header>`;
}

const dir = (c) => (/^\s*[-−]/.test(c || "") ? "down" : /^\s*\+/.test(c || "") ? "up" : "");
const arrow = (c) => (dir(c) === "up" ? "▲" : dir(c) === "down" ? "▼" : "");
const srcLine = (i) => (i.source ? `<span class="src">${esc(i.source)}</span>` : "");

function frontPage(defs, brief) {
  const S = brief.sections || {};
  const health = defs.find((d) => d.type === "health");
  const status = defs.find((d) => d.type === "status");
  const headline = cleanHeadline(brief.headline) || `Your brief for ${brief.longDate}`;
  const bullets = brief.highlights?.length
    ? `<ul class="bullets">${brief.highlights.map((h) => `<li><b>${esc(h.label)}.</b> ${esc(h.text)}</li>`).join("")}</ul>`
    : "";

  const s = status && S[status.id];
  let statusBox = "";
  if (status) {
    if (s?.ok) {
      const label = { clear: "No major issues found", issues: "Issues reported", unknown: "Status unclear" }[s.status];
      const inc = s.items?.length
        ? `<ul class="inc">${s.items.map((i) => `<li><a href="${href(i.url)}" rel="noopener">${esc(i.title)}</a>${esc(i.summary)}</li>`).join("")}</ul>`
        : "";
      statusBox = `<section class="box" id="${status.id}"><h2>${esc(status.title)}</h2><p class="status"><i class="${s.status}" aria-hidden="true"></i>${label}</p><p class="note">${esc(s.statusNote)}</p>${inc}</section>`;
    } else {
      statusBox = `<section class="box" id="${status.id}"><h2>${esc(status.title)}</h2><p class="note">Not checked this morning. See status.salesforce.com for live status.</p></section>`;
    }
  }
  const tables = defs
    .filter((d) => d.type === "market" && S[d.id]?.ok && S[d.id].snapshot?.length)
    .map((d) => `<table class="mkt"><caption>${esc(d.title)}</caption><tbody>${S[d.id].snapshot
      .map((r) => `<tr><td>${esc(r.label)}</td><td>${esc(r.value)}</td><td class="${dir(r.change)}">${arrow(r.change)} ${esc(String(r.change).replace(/^\s*[+\-−]/, ""))}</td></tr>`)
      .join("")}</tbody></table>`)
    .join("");
  const marketBox = tables ? `<section class="box"><h2>Markets</h2>${tables}</section>` : "";

  const h = health && S[health.id];
  const opinion = h?.ok
    ? `<aside class="opinion" id="${health.id}"><p class="kicker">${esc(health.title)}</p>
<blockquote>“${esc(h.quote.text)}”<cite>${esc(h.quote.author)}</cite></blockquote>
<h3>${esc(h.tip.title)}</h3><p>${esc(h.tip.body)}</p></aside>`
    : `<aside class="opinion"></aside>`;

  return `<section class="front">
<article class="top-story"><p class="kicker">Today’s top stories</p><h1>${esc(headline)}</h1>${bullets}</article>
<div class="markets">${statusBox}${marketBox}</div>
${opinion}
</section>`;
}

function section(def, data) {
  const head = `<h2><a href="#${def.id}">${esc(def.title)}</a></h2>`;
  if (!data?.ok || !data.items?.length) {
    return `<section class="sec" id="${def.id}">${head}<p class="missing">Not updated this morning. It will refresh in tomorrow’s brief.</p></section>`;
  }
  const [lead, ...rest] = data.items;
  const list = rest.length
    ? `<ul class="list">${rest.map((i) => `<li><h3><a href="${href(i.url)}" rel="noopener">${esc(i.title)}</a></h3><p>${esc(i.summary)}</p>${srcLine(i)}</li>`).join("")}</ul>`
    : "<div></div>";
  return `<section class="sec" id="${def.id}">${head}<div class="grid">
<article class="lead"><h3><a href="${href(lead.url)}" rel="noopener">${esc(lead.title)}</a></h3><p>${esc(lead.summary)}</p>${srcLine(lead)}</article>
${list}</div></section>`;
}

function dayPage(site, defs, brief, nav) {
  const newsDefs = defs.filter((d) => d.type === "news" || d.type === "market");
  const body = `${header(site, brief, nav, newsDefs)}
<main>
${frontPage(defs, brief)}
${newsDefs.map((d) => section(d, brief.sections?.[d.id])).join("\n")}
</main>`;
  const headline = cleanHeadline(brief.headline);
  return layout({ site, title: `${brandParts(site).masthead}, ${brief.longDate}`, description: headline, body });
}

function archivePage(site, briefs) {
  const list = [...briefs].reverse()
    .map((b) => `<li><span class="d">${esc(b.longDate)}</span><a href="/${b.date}/">${esc(cleanHeadline(b.headline) || "Morning brief")}</a></li>`)
    .join("");
  const body = `${header(site, null, {}, null)}
<main><h1 class="arch-title">Past editions</h1><ul class="arch">${list || "<li>The first edition will appear here after the next morning run.</li>"}</ul></main>`;
  return layout({ site, title: `${brandParts(site).masthead}, past editions`, description: "Every past morning brief.", body });
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
