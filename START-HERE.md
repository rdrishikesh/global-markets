# START HERE: publish your site in about 15 minutes

You do not need to install anything on your computer. Everything happens in your web browser.
At the end you get a link like `https://YOUR-NAME.github.io/global-markets/` that you can send to friends.

## Free mode (no Claude credits needed)

You can run everything below **without a Claude key and without spending anything**. Skip step 3 and step 4. The site then shows prices for all 25 indices and 11 factors, the statistics, the historical look-alike analysis and the latest headlines with links. It does **not** show the written plain-English and technical analysis, which is the only part that uses Claude. You can add the key later (steps 3 and 4) and run the workflow again; nothing else changes.

## What you need

| Item | Cost | Where |
|---|---|---|
| GitHub account | Free | https://github.com/signup |
| Claude API key (optional, for the written analysis) | Pay as you go, about $5 to $10 a month, see "Cost" below | https://console.anthropic.com |

## Steps

| # | Do this | Why |
|---|---|---|
| 1 | On GitHub click **New repository**. Name it e.g. `global-markets`. Choose **Public**. Click **Create repository**. | Free GitHub Pages hosting needs a public repository. Your API key will NOT be public (step 4). |
| 2 | On the new repository page click **uploading an existing file**. Drag in **everything inside this folder**, including the hidden `.github` folder. Click **Commit changes**. | This puts the site's code on GitHub. If you cannot see `.github` on your computer, enable "show hidden files" first. |
| 3 (optional) | In Claude Console (console.anthropic.com): **Settings > Limits**, set a monthly spend limit (e.g. $30). Then **API keys > Create key**, copy it. | The limit protects you from surprises. |
| 4 (optional) | On GitHub: your repository > **Settings > Secrets and variables > Actions > New repository secret**. Name: `ANTHROPIC_API_KEY`. Value: paste the key. Click **Add secret**. | The key stays hidden from visitors and from the code. Never paste it in a file or a chat. |
| 5 | **Settings > Pages**. Under **Build and deployment > Source** choose **GitHub Actions**. | Tells GitHub to publish the site. |
| 6 | Open the **Actions** tab. Click **Update market data and deploy** (left), then **Run workflow > Run workflow**. Wait about 5 minutes for the first run. | The first run creates the first data. |
| 7 | When the run turns green, click it. The summary at the bottom shows **Your site is live** and the link. Open it and send it to your friends. | Done. |

After this the site refreshes itself twice every weekday: 4:00 pm India time (Asia closed, Europe open) and 4:45 am India time (after the US close).

## If something goes wrong

| What you see | Meaning | Fix |
|---|---|---|
| Page says "No market data has been published yet" | The first run has not finished or failed | Actions tab > open the latest run > read the red or yellow line |
| "Free mode" note on the site | No key is set | Expected without a key. To add the analysis, do steps 3 and 4, then Run workflow |
| `401` / `authentication` in the log | Key wrong or revoked | Create a new key, update the secret |
| `credit balance is too low` | No API credit | Add credit in the Console |
| Yellow note "N news feed(s) could not be read" | Some free news feeds were down or changed address | Normal. Edit the list in `server/news.ts` if one stays broken |
| "only N fresh headlines were collected" | Too many feeds failed at once | Nothing is spent on Claude; numbers still update. Re-run later |
| `Quality gate failed` | Free price source (Yahoo Finance) blocked too many requests | Nothing was published, the old data stays. Run workflow again later |
| `429` / rate limit | Account limits on a new Anthropic account | Wait and re-run; limits grow with usage |
| `Get Pages site failed` | Step 5 not done | Do step 5 and re-run |
| Banner "Data is N hours old" | Scheduled updates stopped (GitHub pauses schedules in repositories with no activity for 60 days) | Actions tab > re-enable the workflow > Run workflow |
| Banner "analysis could not be produced" | Claude step failed once; prices are fresh, text is older | Usually fixes itself on the next run |

## Cost (please read)

| Item | What it costs |
|---|---|
| News and prices | Free. Plain code reads public RSS feeds and Yahoo Finance; Claude does no web searching |
| Claude | One analysis call per update, roughly 20,000 words-worth of input and up to 12,000 tokens of output. At Claude Sonnet 5.5 prices ($2 per million input tokens, $10 per million output tokens, see https://platform.claude.com/docs) that is **about $0.10 to $0.20 per update, roughly $5 to $10 a month** at two updates per weekday. This is my estimate, not a measurement: check **Console > Usage** after a few runs |
| Skipped when pointless | If headlines and prices are unchanged, or fewer than 20 headlines arrive, Claude is not called at all |
| Visitors, uploading files | Free. The site only shows a saved file |
| GitHub Pages and Actions | Free for public repositories within GitHub's limits |

To spend less: delete one of the two `cron` lines in `.github/workflows/deploy.yml`, or set a repository variable `ANTHROPIC_MODEL` to a smaller Claude model (cheaper, with weaker analysis; check its current price).

## Change things later

- Edit a file: open it on GitHub, click the pencil icon, change, **Commit**. The site rebuilds itself.
- Add or remove tracked indices: `src/data/catalog.ts`.
- Add or remove news feeds: `server/news.ts`. Add or remove trusted publishers: `server/sources.ts`.
