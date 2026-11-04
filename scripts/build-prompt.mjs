// Builds today's instructions for Claude Code from brief.config.mjs.
// Used by the workflow: node scripts/build-prompt.mjs > prompt.txt
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SITE, SECTIONS } from "../brief.config.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, "data");
const tz = SITE.timezone;
const now = new Date();
const date =
  process.env.BRIEF_DATE ||
  new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
const longDate = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-AU", {
  weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
});
const clock = new Intl.DateTimeFormat("en-AU", { timeZone: tz, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(now);
const outFile = path.join(DATA_DIR, `${date}.json`);

async function recentHealth() {
  try {
    const files = (await readdir(DATA_DIR)).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f) && !f.startsWith(date)).sort().slice(-14);
    const lines = [];
    for (const f of files) {
      const h = JSON.parse(await readFile(path.join(DATA_DIR, f), "utf8")).sections?.health;
      if (h?.ok) lines.push(`- ${h.tip?.title} / "${h.quote?.text}" (${h.quote?.author})`);
    }
    return lines.join("\n") || "(none yet)";
  } catch {
    return "(none yet)";
  }
}

const ITEM = `{ "title": "short headline in your own words", "url": "https://...", "source": "publication name", "summary": "two plain sentences: what happened and why it matters" }`;

function schemaFor(s) {
  switch (s.type) {
    case "health":
      return `{ "ok": true, "tip": { "title": "short tip title", "body": "two or three sentences" }, "quote": { "text": "the quote", "author": "real author" } }`;
    case "market":
      return `{ "ok": true, "snapshot": [ { "label": "index or rate name", "value": "level", "change": "+0.00%" } ], "items": [ ${ITEM} ] }   (up to ${s.count} items)`;
    case "status":
      return `{ "ok": true, "status": "clear" or "issues" or "unknown", "statusNote": "one sentence overall summary", "items": [ ${ITEM} ] }   (0 to ${s.count} items; empty if all clear)`;
    default:
      return `{ "ok": true, "items": [ ${ITEM} ] }   (exactly ${s.count} items, most important first)`;
  }
}

const health = await recentHealth();

const sectionText = SECTIONS.map((s) => {
  const head =
    s.type === "health"
      ? `### "${s.id}": ${s.title} (no web search needed)`
      : `### "${s.id}": ${s.title} (about ${s.maxSearches} searches)`;
  const extra = s.type === "health" ? `\nAvoid repeating these recent tips and quotes:\n${health}` : "";
  return `${head}\n${s.brief}${extra}\nJSON for this section:\n${schemaFor(s)}`;
}).join("\n\n");

const skeleton = `{
  "date": "${date}",
  "longDate": "${longDate}",
  "clock": "${clock}",
  "generatedAt": "${now.toISOString()}",
  "model": "Claude Code (subscription)",
  "headline": "one sentence starting 'Good morning — ' naming the biggest one or two stories",
  "highlights": [ { "label": "2-3 word label", "text": "one sentence, under 25 words" } ],
  "sections": {
${SECTIONS.map((s) => `    "${s.id}": { ...section JSON... }`).join(",\n")}
  }
}`;

console.log(`You are running unattended inside a GitHub Actions job, writing a personal morning news brief for a reader in ${SITE.city}, Australia. Nobody can answer questions, so never ask any; make sensible choices and finish the job.

Today is ${longDate}, ${clock}.

TASK
1. Research every section below with WebSearch. Use WebFetch only when a search result is too thin to summarise accurately. Keep to roughly the suggested number of searches per section.
2. Use the Write tool to save the finished brief as ONE file at this exact path:
   ${outFile}
   Do not create, edit or delete any other file.
3. Stop once the file is written. Do not print the brief.

RULES
- Use news published in the last 48 hours, preferring the last 24. Only use older stories when nothing newer exists, and say so briefly.
- Prefer original, reputable sources: official sites, major news outlets, company newsrooms.
- Every item must link to a real article URL that appeared in your search results. Never invent or guess a URL.
- Write in your own words in Australian English. Do not copy sentences from articles.
- Include figures, names and dates only when a source states them. Mark preliminary or unconfirmed figures.
- Write as a neutral news editor. Never use "I", "we" or "my". For caveats write things like "Not independently confirmed." or "No major data scheduled today."
- No duplicate stories within a section.
- If a section truly cannot be researched, set it to { "ok": false, "error": "short reason" } and carry on with the rest.

SECTIONS

${sectionText}

FILE FORMAT
The file must be strict, valid JSON: double quotes only, no comments, no trailing commas, no markdown fences. Use this exact shape:
${skeleton}

"highlights" must contain exactly 3 entries, taken from different news sections (not health).`);
