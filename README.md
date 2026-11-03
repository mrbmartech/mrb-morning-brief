# Morning Brief

Every morning a GitHub Action asks Claude (with web search) to research your topics, saves the
results in `data/`, builds the pages in `public/`, and pushes them. Vercel publishes the site
automatically within a minute.

```
GitHub Actions (7am daily) → Claude API + web search → data/YYYY-MM-DD.json
→ public/ pages → commit → Vercel redeploys
```

## One-time setup (about 20 minutes, browser only)

### 1. Get a Claude API key
Your Claude chat subscription does not include API access; the API is billed separately.
1. Go to https://console.anthropic.com and sign in (same email is fine).
2. **Billing** → add a small amount of credit, and set a **monthly spend limit** so costs can't run away.
3. **API keys** → **Create key** → copy it somewhere safe. You only see it once.
4. In the Console settings, make sure **web search** is enabled for your organisation.

### 2. Create the GitHub repository
1. On github.com click **+** (top right) → **New repository**.
2. Name it `morning-brief`. Public or Private both work.
3. Do **not** tick "Add a README". Click **Create repository**.

### 3. Upload the files
1. Unzip `morning-brief.zip` on your computer.
2. On the new repo page, click the link **uploading an existing file**.
3. Open the unzipped `morning-brief` folder, select **everything inside it** (not the folder itself) and drag it into the browser.
   - Mac: the `.github` folder is hidden. Press **Cmd + Shift + .** in Finder to show it.
4. Click **Commit changes**.
5. Check the repo shows a `.github` folder. If it doesn't, see "Workflow file missing" below.

### 4. Add your API key as a secret
Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
- Name: `ANTHROPIC_API_KEY`
- Secret: paste your key → **Add secret**

### 5. Run it once by hand
Repo → **Actions** tab → (click **I understand… enable** if asked) → **Daily morning brief** →
**Run workflow** → **Run workflow**. It takes about 5–15 minutes. A green tick means success.
Click into the run to see each section's progress and the token/search usage.

### 6. Put it on Vercel
1. Go to https://vercel.com → **Add New…** → **Project**.
2. **Import** your `morning-brief` repo (allow Vercel's GitHub app to access it if asked).
3. Framework Preset: **Other**. Leave build settings empty. Click **Deploy**.
4. Your site address appears, e.g. `morning-brief-xxxx.vercel.app`. Bookmark it on your phone.

From now on it runs every day at about 7am Melbourne time (6am in winter) with no action needed.

## Changing things
Edit `brief.config.mjs` on GitHub (open the file → pencil icon → **Commit changes**):
- section titles, emoji, number of stories (`count`)
- what each section looks for (`brief`)
- `maxSearches` per section (fewer = cheaper)
- the model, via `MODEL`
- the run time: edit `cron` in `.github/workflows/daily-brief.yml` (it's in UTC)

## Cost
You pay per token plus a small fee per web search. Check the Usage line in each run's log and
your Console usage page after the first few days; lower `maxSearches` or switch to a cheaper
model if needed.

## Troubleshooting
- **Red cross on the run:** open the run → "Write today's brief" step and read the error.
  `401` = wrong API key secret. `400 … credit` = add credit. Web search errors = enable web search in the Console.
- **"Permission denied" when pushing:** Settings → Actions → General → Workflow permissions →
  **Read and write permissions** → Save.
- **Vercel didn't update:** Vercel → your project → Deployments to see the error. If it mentions a
  commit author on a private repo, make the repo public or check you imported it under your own account.
- **A section says "couldn't be updated":** that section failed today; the rest still published.
- **Workflow file missing** (no Actions to run): in the repo click **Add file** → **Create new file**,
  type the name `.github/workflows/daily-brief.yml`, paste the contents below, **Commit changes**.

```yaml
name: Daily morning brief

on:
  schedule:
    # 20:00 UTC = 7:00am Melbourne in summer (AEDT), 6:00am in winter (AEST).
    # GitHub can start scheduled runs up to ~30 minutes late.
    - cron: "0 20 * * *"
  workflow_dispatch: # adds a "Run workflow" button for manual runs

permissions:
  contents: write

concurrency:
  group: morning-brief
  cancel-in-progress: false

jobs:
  brief:
    runs-on: ubuntu-latest
    timeout-minutes: 40
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Write today's brief
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: node scripts/generate.mjs

      - name: Publish (Vercel redeploys automatically)
        run: |
          git config user.name "${{ github.repository_owner }}"
          git config user.email "${{ github.repository_owner_id }}+${{ github.repository_owner }}@users.noreply.github.com"
          git add data public
          if git diff --cached --quiet; then echo "Nothing new to publish"; exit 0; fi
          git commit -m "Morning brief $(TZ=Australia/Melbourne date +%F)"
          git push
```
