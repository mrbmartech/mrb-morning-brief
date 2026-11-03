// ─────────────────────────────────────────────────────────────
//  Morning Brief settings. This is the only file you need to edit.
//  Change titles, how many stories, or what each section looks for.
// ─────────────────────────────────────────────────────────────

export const SITE = {
  title: "Morning Brief",
  city: "Melbourne",
  timezone: "Australia/Melbourne",
  footer:
    "Written each morning by AI from public reporting. Summaries are paraphrased and may contain errors, so check the source before acting. Market content is information, not financial advice.",
};

// Claude model used for the brief. Change it here if you want a cheaper or stronger model.
export const MODEL = process.env.BRIEF_MODEL || "claude-sonnet-5-5";

// Section types:
//   health = a tip and a quote (no web search, very cheap)
//   news   = a ranked list of stories
//   market = an index snapshot plus stories
//   status = an all-clear or issues banner plus incidents
// maxSearches caps the web searches per section, which caps cost.
export const SECTIONS = [
  {
    id: "health",
    emoji: "🌅",
    title: "Health & fitness",
    type: "health",
    brief:
      "Give one practical, safe, evidence-based health or fitness tip a busy working adult can act on today (movement, strength, sleep, hydration, healthy eating habits, or stress). Keep it general: no diagnoses, supplements, extreme diets or calorie targets. Also give one genuine motivational quote with its real author. Only use a quote you are confident is correctly attributed.",
  },
  {
    id: "martech",
    emoji: "📣",
    title: "MarTech",
    type: "news",
    count: 5,
    maxSearches: 5,
    brief:
      "Top marketing technology news: platform launches and updates (Salesforce Marketing Cloud, Adobe Experience Cloud, Oracle Eloqua, HubSpot, Braze, Tealium and other CDPs), AI in marketing, email deliverability and inbox-provider changes, and privacy or consent changes affecting marketers. Good sources include MarTech.org, MarTech Series, Marketing Dive and vendor newsrooms.",
  },
  {
    id: "salesforce",
    emoji: "☁️",
    title: "Salesforce news",
    type: "news",
    count: 5,
    maxSearches: 5,
    brief:
      "Top Salesforce news and product updates: Agentforce, Data Cloud, Marketing Cloud, Sales and Service Cloud, release notes and release dates, pricing changes, acquisitions, earnings, and leadership news. Prefer salesforce.com newsroom, Salesforce Ben, and major tech press.",
  },
  {
    id: "sfstatus",
    emoji: "🚦",
    title: "Salesforce issues & downtime",
    type: "status",
    count: 5,
    maxSearches: 4,
    brief:
      "Check for Salesforce service incidents, outages, degraded performance and planned maintenance, focusing on Marketing Cloud (Engagement and Personalization), Sales/Service Cloud, and Data Cloud, especially in APAC/AU instances. Look at status.salesforce.com (Salesforce Trust), Salesforce Known Issues, and outage reports. Cover the last 48 hours plus maintenance planned for the next 7 days. If nothing significant is found, set status to clear.",
  },
  {
    id: "australia",
    emoji: "🇦🇺",
    title: "Australia top 5",
    type: "news",
    count: 5,
    maxSearches: 5,
    brief:
      "The five most important Australian news stories right now: national politics, economy, major events, and significant Victorian stories. Prefer ABC News, SBS, The Guardian Australia, AFR, and The Age.",
  },
  {
    id: "india",
    emoji: "🇮🇳",
    title: "India top 5",
    type: "news",
    count: 5,
    maxSearches: 5,
    brief:
      "The five most important national news stories from India right now: politics, economy, policy, major events. Prefer The Hindu, Indian Express, Times of India, Hindustan Times, NDTV, and PTI.",
  },
  {
    id: "andhra",
    emoji: "📍",
    title: "Andhra Pradesh top 5",
    type: "news",
    count: 5,
    maxSearches: 5,
    brief:
      "The five most important news stories from Andhra Pradesh right now: state government and politics, Amaravati, development projects, economy, weather and major local events. English sources preferred (The Hindu AP edition, Deccan Chronicle, Times of India Vijayawada/Visakhapatnam, The New Indian Express). Telugu sources are fine, but write summaries in English.",
  },
  {
    id: "usstocks",
    emoji: "📈",
    title: "US stocks",
    type: "market",
    count: 5,
    maxSearches: 5,
    brief:
      "US share market wrap for the most recent completed trading session: closing level and % change for the S&P 500, Nasdaq Composite and Dow Jones in the snapshot, then the biggest market-moving stories (earnings, big movers, Fed and economic data, what's coming next).",
  },
  {
    id: "austocks",
    emoji: "📊",
    title: "AU stocks",
    type: "market",
    count: 5,
    maxSearches: 5,
    brief:
      "Australian share market wrap: ASX 200 close and % change from the most recent session and the AUD/USD rate in the snapshot (add ASX 200 futures if available), then the biggest stories (big movers, results, RBA and economic data, what's coming up today).",
  },
  {
    id: "property",
    emoji: "🏠",
    title: "Australian real estate top 5",
    type: "news",
    count: 5,
    maxSearches: 5,
    brief:
      "The five most important Australian property and housing stories: home values and forecasts (Cotality/CoreLogic, PropTrack, bank economists), auction clearance rates, interest rates and lending, rental market, and housing policy.",
  },
];
