// Generates today's brief with the Claude API (web search on), saves it as JSON,
// then rebuilds the website pages. Run: node scripts/generate.mjs
// Rebuild pages only, no API calls: node scripts/generate.mjs --render-only

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SITE, MODEL, SECTIONS } from "../brief.config.mjs";
import { renderAll } from "./render.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, "data");
const API_URL = "https://api.anthropic.com/v1/messages";
const RENDER_ONLY = process.argv.includes("--render-only");

const now = new Date();
const tz = SITE.timezone;
const isoDate = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
const longDate = new Intl.DateTimeFormat("en-AU", { timeZone: tz, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now);
const clock = new Intl.DateTimeFormat("en-AU", { timeZone: tz, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(now);

const usage = { inputTokens: 0, outputTokens: 0, searches: 0 };

const SYSTEM = `You are the editor of a personal morning news brief for a reader in ${SITE.city}, Australia.
Today is ${longDate}, ${clock}.

Rules:
- Use web search to find news published in the last 48 hours, preferring the last 24. Only use older stories if nothing newer exists.
- Prefer original, reputable sources: official sites, major news outlets, company newsrooms.
- Every item must link to a real article URL that appeared in your search results. Never invent or guess a URL.
- Write in your own words in Australian English. Do not copy sentences from articles.
- Include figures, names and dates only when a source states them. Say when a figure is preliminary or unconfirmed.
- No duplicate stories within a section.
- When you finish, output ONLY the requested JSON object wrapped in <json> and </json> tags.`;

const ITEM = `{ "title": "short headline in your own words", "url": "https://...", "source": "publication name", "summary": "two plain sentences: what happened and why it matters" }`;

function schemaFor(section) {
  switch (section.type) {
    case "health":
      return `{ "tip": { "title": "short tip title", "body": "two or three sentences" }, "quote": { "text": "the quote", "author": "real author" } }`;
    case "market":
      return `{ "snapshot": [ { "label": "index or rate name", "value": "level", "change": "+0.00%" } ], "items": [ ${ITEM} ] }  (up to ${section.count} items)`;
    case "status":
      return `{ "status": "clear" | "issues" | "unknown", "statusNote": "one sentence overall summary", "items": [ ${ITEM} ] }  (0 to ${section.count} items; empty if all clear)`;
    default:
      return `{ "items": [ ${ITEM} ] }  (exactly ${section.count} items, most important first)`;
  }
}

async function post(body, attempt = 0) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  if (res.ok) return res.json();
  const text = await res.text();
  if ([429, 500, 502, 503, 529].includes(res.status) && attempt < 4) {
    const wait = Number(res.headers.get("retry-after")) * 1000 || 15000 * 2 ** attempt;
    console.log(`  API busy (${res.status}), retrying in ${Math.round(wait / 1000)}s`);
    await new Promise((r) => setTimeout(r, wait));
    return post(body, attempt + 1);
  }
  throw new Error(`API error ${res.status}: ${text.slice(0, 400)}`);
}

async function askClaude({ prompt, search = false, maxSearches = 5, maxTokens = 4000, system = SYSTEM }) {
  const messages = [{ role: "user", content: prompt }];
  const body = { model: MODEL, max_tokens: maxTokens, system, messages };
  if (search) body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: maxSearches }];

  let text = "";
  for (let turn = 0; turn < 6; turn++) {
    const data = await post(body);
    usage.inputTokens += data.usage?.input_tokens || 0;
    usage.outputTokens += data.usage?.output_tokens || 0;
    usage.searches += data.usage?.server_tool_use?.web_search_requests || 0;
    for (const block of data.content || []) if (block.type === "text") text += block.text;
    if (data.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: data.content }); // long research: let Claude continue
  }
  return extractJson(text);
}

function extractJson(text) {
  const tagged = [...text.matchAll(/<json>([\s\S]*?)<\/json>/g)].pop();
  let raw = tagged ? tagged[1] : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  raw = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(raw);
}

const cleanItems = (items, max) =>
  (Array.isArray(items) ? items : [])
    .filter((i) => i && i.title && /^https?:\/\//.test(i.url || ""))
    .slice(0, max || 10);

async function loadRecent(days) {
  try {
    const files = (await readdir(DATA_DIR)).filter((f) => f.endsWith(".json")).sort().slice(-days);
    return Promise.all(files.map(async (f) => JSON.parse(await readFile(path.join(DATA_DIR, f), "utf8"))));
  } catch {
    return [];
  }
}

async function runSection(section, recent) {
  if (section.type === "health") {
    const used = recent
      .map((b) => b.sections?.health)
      .filter((h) => h?.ok)
      .map((h) => `- ${h.tip?.title} / "${h.quote?.text}" (${h.quote?.author})`)
      .join("\n");
    const out = await askClaude({
      prompt: `${section.brief}\n\nAvoid repeating these recent tips and quotes:\n${used || "(none yet)"}\n\nReturn this JSON shape:\n${schemaFor(section)}`,
      maxTokens: 1000,
    });
    if (!out.tip?.body || !out.quote?.text) throw new Error("Missing tip or quote");
    return { tip: out.tip, quote: out.quote };
  }

  const out = await askClaude({
    prompt: `Section: ${section.title}\n${section.brief}\n\nReturn this JSON shape:\n${schemaFor(section)}`,
    search: true,
    maxSearches: section.maxSearches,
  });
  const items = cleanItems(out.items, section.count);
  if (section.type === "status") {
    const status = ["clear", "issues", "unknown"].includes(out.status) ? out.status : "unknown";
    return { status, statusNote: out.statusNote || "", items };
  }
  if (!items.length) throw new Error("No usable stories returned");
  if (section.type === "market") return { snapshot: Array.isArray(out.snapshot) ? out.snapshot.slice(0, 6) : [], items };
  return { items };
}

async function runHeadline(sections) {
  const digest = SECTIONS.filter((s) => s.type !== "health" && sections[s.id]?.ok)
    .map((s) => `## ${s.title}\n` + (sections[s.id].items || []).map((i) => `- ${i.title}: ${i.summary}`).join("\n"))
    .join("\n\n");
  const out = await askClaude({
    system: `You write the top of a personal morning brief for a reader in ${SITE.city}. Today is ${longDate}. Use only the stories given. Australian English, plain and calm. Output only JSON wrapped in <json></json>.`,
    prompt: `${digest}\n\nReturn: { "headline": "one sentence starting 'Good morning — ' naming the biggest one or two stories", "highlights": [ { "label": "2-3 word label", "text": "one sentence, under 25 words" } ] } with exactly 3 highlights from different sections.`,
    maxTokens: 800,
  });
  return { headline: String(out.headline || ""), highlights: (out.highlights || []).slice(0, 3) };
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true });

  if (!RENDER_ONLY) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set. Add it as a GitHub Actions secret.");
    console.log(`Building brief for ${longDate} with ${MODEL}`);
    const recent = await loadRecent(14);
    const sections = {};
    let ok = 0;

    for (const section of SECTIONS) {
      console.log(`→ ${section.title}`);
      try {
        sections[section.id] = { ok: true, ...(await runSection(section, recent)) };
        ok++;
      } catch (err) {
        console.error(`  ✗ ${section.title}: ${err.message}`);
        sections[section.id] = { ok: false, error: String(err.message).slice(0, 300) };
      }
    }
    if (ok === 0) {
      console.error("Every section failed, so nothing was published. Check the errors above.");
      process.exit(1);
    }

    let top = { headline: `Good morning — here’s your brief for ${longDate}.`, highlights: [] };
    try {
      const h = await runHeadline(sections);
      if (h.headline) top = h;
    } catch (err) {
      console.error(`  ✗ Headline: ${err.message}`);
    }

    const brief = { date: isoDate, longDate, clock, generatedAt: now.toISOString(), model: MODEL, ...top, sections, usage };
    await writeFile(path.join(DATA_DIR, `${isoDate}.json`), JSON.stringify(brief, null, 2));
    console.log(`Saved data/${isoDate}.json (${ok}/${SECTIONS.length} sections)`);
    console.log(`Usage: ${usage.inputTokens} input tokens, ${usage.outputTokens} output tokens, ${usage.searches} web searches`);
  }

  const pages = await renderAll({ root: ROOT, dataDir: DATA_DIR, site: SITE, sections: SECTIONS });
  console.log(`Rendered ${pages} daily page(s) into public/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
