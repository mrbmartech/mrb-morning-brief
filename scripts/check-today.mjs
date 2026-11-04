// Checks the brief Claude Code wrote today, cleans anything malformed,
// and stops the job (so nothing bad is published) if it's unusable.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SITE, SECTIONS } from "../brief.config.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const date =
  process.env.BRIEF_DATE ||
  new Intl.DateTimeFormat("en-CA", { timeZone: SITE.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const file = path.join(ROOT, "data", `${date}.json`);

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

let brief;
try {
  const raw = (await readFile(file, "utf8")).replace(/^\uFEFF/, "").replace(/```json|```/g, "").trim();
  brief = JSON.parse(raw);
} catch (err) {
  fail(err.code === "ENOENT" ? `Claude didn't write data/${date}.json. Check the step above for the reason.` : `data/${date}.json isn't valid JSON: ${err.message}`);
}

const cleanItems = (items, max) =>
  (Array.isArray(items) ? items : [])
    .filter((i) => i && i.title && /^https?:\/\//.test(i.url || ""))
    .map((i) => ({ title: String(i.title), url: i.url, source: String(i.source || ""), summary: String(i.summary || "") }))
    .slice(0, max || 10);

function cleanSection(def, s) {
  if (!s || s.ok === false) return { ok: false, error: String(s?.error || "Not returned") };
  if (def.type === "health") {
    if (!s.tip?.body || !s.quote?.text) return { ok: false, error: "Missing tip or quote" };
    return { ok: true, tip: { title: String(s.tip.title || ""), body: String(s.tip.body) }, quote: { text: String(s.quote.text), author: String(s.quote.author || "") } };
  }
  const items = cleanItems(s.items, def.count);
  if (def.type === "status") {
    const status = ["clear", "issues", "unknown"].includes(s.status) ? s.status : "unknown";
    return { ok: true, status, statusNote: String(s.statusNote || ""), items };
  }
  if (!items.length) return { ok: false, error: "No usable stories" };
  if (def.type === "market") {
    const snapshot = (Array.isArray(s.snapshot) ? s.snapshot : [])
      .filter((x) => x && x.label)
      .slice(0, 6)
      .map((x) => ({ label: String(x.label), value: String(x.value ?? ""), change: String(x.change ?? "") }));
    return { ok: true, snapshot, items };
  }
  return { ok: true, items };
}

const sections = {};
let ok = 0;
for (const def of SECTIONS) {
  sections[def.id] = cleanSection(def, brief.sections?.[def.id]);
  if (sections[def.id].ok) ok++;
  else console.log(`  ✗ ${def.title}: ${sections[def.id].error}`);
}
if (ok === 0) fail("Every section is empty, so nothing will be published.");

const longDate = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-AU", {
  weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
});
const cleaned = {
  date,
  longDate: brief.longDate || longDate,
  clock: String(brief.clock || ""),
  generatedAt: brief.generatedAt || new Date().toISOString(),
  model: brief.model || "Claude Code (subscription)",
  headline: String(brief.headline || `Good morning — here’s your brief for ${longDate}.`),
  highlights: (Array.isArray(brief.highlights) ? brief.highlights : [])
    .filter((h) => h && h.label && h.text)
    .slice(0, 3)
    .map((h) => ({ label: String(h.label), text: String(h.text) })),
  sections,
};

await writeFile(file, JSON.stringify(cleaned, null, 2));
console.log(`✓ data/${date}.json checked: ${ok}/${SECTIONS.length} sections ready`);
