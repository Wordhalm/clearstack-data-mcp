<p>
  <img src="https://raw.githubusercontent.com/Wordhalm/clearstack-data-mcp/main/assets/icon.png" alt="ClearStack Data logo" width="64" height="64" />
</p>

# ClearStack Data MCP Server

[![CI](https://github.com/Wordhalm/clearstack-data-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Wordhalm/clearstack-data-mcp/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/clearstack-data-mcp.svg)](https://www.npmjs.com/package/clearstack-data-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP_Registry-published-2ea44f)](https://registry.modelcontextprotocol.io/v0.1/servers?search=clearstack-data-mcp)
[![Glama MCP server](https://glama.ai/mcp/servers/Wordhalm/clearstack-data-mcp/badges/score.svg)](https://glama.ai/mcp/servers/Wordhalm/clearstack-data-mcp)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Live B2B & OSINT research tools for **Claude Code**, **Claude Desktop**, **Cursor**, **Windsurf**, and **VS Code**: career-site job openings (with salaries & tech stack), Google Ads Transparency Center (with EU DSA impressions), public Telegram channels (with OSINT/crypto extraction), EU VAT/company registry verification + OFAC/EU/UN sanctions screening, and EU/France/UK public tenders & contract awards.

[<img src="https://cursor.com/deeplink/mcp-install-dark.svg" alt="Install in Cursor" height="32">](https://cursor.com/en/install-mcp?name=clearstack-data&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsImNsZWFyc3RhY2stZGF0YS1tY3AiXSwiZW52Ijp7IkFQSUZZX1RPS0VOIjoiWU9VUl9BUElGWV9UT0tFTiJ9fQ%3D%3D)
[<img src="https://img.shields.io/badge/VS_Code-Install_MCP-0098FF?style=for-the-badge&logo=visualstudiocode&logoColor=white" alt="Install in VS Code" height="32">](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522clearstack-data%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522-y%2522%252C%2522clearstack-data-mcp%2522%255D%252C%2522env%2522%253A%257B%2522APIFY_TOKEN%2522%253A%2522%2524%257Binput%253Aapify-token%257D%2522%257D%252C%2522inputs%2522%253A%255B%257B%2522type%2522%253A%2522promptString%2522%252C%2522id%2522%253A%2522apify-token%2522%252C%2522description%2522%253A%2522Apify%2520API%2520token%2522%252C%2522password%2522%253Atrue%257D%255D%257D)

```bash
claude mcp add clearstack-data -e APIFY_TOKEN=your_token -- npx -y clearstack-data-mcp
```

## What it does

| Tool | Data source | Typical question | Cost on Apify |
| --- | --- | --- | --- |
| `search_ats_jobs` | Greenhouse, Lever, Ashby, SmartRecruiters (25,787 employers) | "Find Senior/Staff Python + Kubernetes roles paying $180k+ at OpenAI, Stripe, or Monzo." | $0.002 + $0.0015 / job |
| `search_google_ads` | Google Ads Transparency Center (Search, Display, YouTube, EU DSA) | "Which Google Ads has shopify.com run in France for 30+ days, with EU impression ranges?" | $0.002 + $0.0012 / ad |
| `get_telegram_channel_posts` | Public Telegram channels (OSINT/finance entities, no account needed) | "Fetch posts from t.me/durov with 100k+ views, tickers, external domains, and engagement." | $0.002 + $0.0015 / post |
| `verify_eu_company` | EU VIES VAT + SIRENE (FR), Zefix (CH), Brreg (NO), PRH (FI), GLEIF LEI + **OFAC/EU/UN Sanctions** | "Validate FR22424761419, enrich officers, and screen against OFAC, EU FSF, and UN sanctions." | $0.004 / company |
| `search_eu_tenders` | EU TED (27 EU + EEA), France BOAMP, UK Find a Tender (OCDS) | "List open cloud/cybersecurity tenders >= €100k or recent contract award winners in FR/DE/UK." | $0.002 / tender |
| `get_run_results` | Any in-progress Apify run from the five tools above | Automatically called when a large query exceeds 45 seconds | Free (already paid) |

Each tool calls a [ClearStack Data](https://apify.com/clearstack-data) Actor on [Apify](https://apify.com) using **your own `APIFY_TOKEN`**.
- **Free to try**: Apify's free tier includes monthly platform credits (no credit card required), which is enough for hundreds to thousands of calls.
- **Hard spending cap**: every call passes Apify's `maxTotalChargeUsd`, calculated from the item limit you requested.
- **Read-only & local**: all tools are annotated `readOnlyHint: true`, send your token only to `api.apify.com`, and write nothing to disk.

## Example prompts

Paste any of these into Claude, Cursor, or VS Code after installing:

- **Targeted job search / hiring signals**: *"Find Senior or Staff engineering roles requiring Python and Kubernetes paying at least $180k USD equivalent at OpenAI, Datadog, Cloudflare, or Monzo, with direct apply URLs."*
- **Competitor ad teardown + EU DSA**: *"Pull Google Ads for shopify.com in France that have been running for at least 30 days, include EU DSA details, and rank them by EU impressions."*
- **EU vendor KYB + sanctions check**: *"Verify FR22424761419 and CHE-105.909.036, check VAT validity, list officers, and confirm OFAC/EU/UN sanctions status and any kybRiskFlags."*
- **Public procurement & award intelligence**: *"Find European public contract awards over €250,000 in the last 14 days from EU TED and UK Find a Tender, showing buyers, winning suppliers, and awarded amounts."*
- **Telegram OSINT & market watch**: *"Fetch original posts (no forwards) from t.me/durov and t.me/bloomberg with at least 50k views, showing external domains, tickers, and engagement rate."*

## Install

You have two ways to connect:

1. **Dedicated package (`npx -y clearstack-data-mcp`)** — trimmed token-efficient outputs, automatic `maxTotalChargeUsd` spending caps, and 45 s timeout handling (requires Node.js 20+ and an `APIFY_TOKEN` from [console.apify.com/settings/integrations](https://console.apify.com/settings/integrations)).
2. **Zero-token OAuth via Apify** — no API token to copy or store locally; signs in through your browser via Apify OAuth (exposes the full Actor schemas directly).

### Option A: Zero-token OAuth (no `APIFY_TOKEN` to copy)

**Claude Code:**

```bash
claude mcp add --transport http clearstack-apify "https://mcp.apify.com/?tools=clearstack-data/career-site-jobs-search,clearstack-data/google-ads-transparency-scraper,clearstack-data/telegram-public-channel-monitor,clearstack-data/eu-company-kyb-enricher,clearstack-data/eu-public-tenders-monitor"
```

**Cursor / Claude Desktop (`mcp.json`):**

```json
{
  "mcpServers": {
    "clearstack-apify": {
      "url": "https://mcp.apify.com/?tools=clearstack-data/career-site-jobs-search,clearstack-data/google-ads-transparency-scraper,clearstack-data/telegram-public-channel-monitor,clearstack-data/eu-company-kyb-enricher,clearstack-data/eu-public-tenders-monitor"
    }
  }
}
```

On first use, your client opens a browser window to sign into Apify via OAuth (free tier included).

### Option B: Dedicated MCP package (`npx -y clearstack-data-mcp`, recommended for lower token usage)

#### Claude Code

```bash
claude mcp add clearstack-data -e APIFY_TOKEN=your_token -- npx -y clearstack-data-mcp
```

#### Cursor

Click the **Install in Cursor** button at the top (then replace `YOUR_APIFY_TOKEN` with your token), or add this to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "clearstack-data": {
      "command": "npx",
      "args": ["-y", "clearstack-data-mcp"],
      "env": { "APIFY_TOKEN": "your_token" }
    }
  }
}
```

#### Claude Desktop and Windsurf

In Claude Desktop (`Settings -> Developer -> Edit Config`) or Windsurf (`~/.codeium/windsurf/mcp_config.json`), add the same `mcpServers` block as Cursor above.

#### VS Code

Click the **Install in VS Code** button at the top, or add `.vscode/mcp.json` (VS Code prompts once for the token and stores it securely):

```json
{
  "inputs": [
    { "type": "promptString", "id": "apify-token", "description": "Apify API token", "password": true }
  ],
  "servers": {
    "clearstack-data": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "clearstack-data-mcp"],
      "env": { "APIFY_TOKEN": "${input:apify-token}" }
    }
  }
}
```

## Tool reference

### `search_ats_jobs`

Reads live openings directly from company career sites on Greenhouse, Lever, Ashby, and SmartRecruiters (25,787 employers indexed; browse ATS slugs with [ATS Job Board Finder](https://wordhalm.github.io/ats-job-board-finder/)).

| Parameter | Default | Description |
| --- | --- | --- |
| `companies` | `[]` | Names (`"Stripe"`), `ats:slug` pairs (`"ashby:openai"`), or job board URLs. Empty scans 35 well-known tech and AI employers. |
| `keywords` | `[]` | Match any of them in title, department, or tech stack. |
| `requiredSkills` | `[]` | Require ALL listed skills (aliases like `"k8s"`, `"golang"`, `"postgres"` map automatically). |
| `seniorityLevels` | `[]` | Filter by seniority (`intern`, `entry`, `mid`, `senior`, `staff`, `lead`, `manager`, `director`, `executive`). |
| `minSalaryUsd` | — | Minimum annual salary in approximate USD equivalent (converts USD, EUR, GBP, CHF, CAD, AUD). |
| `location` | `""` | Substring of the location: `"London"`, `"Remote"`, `"Germany"`. |
| `remoteOnly` | `false` | Return only roles marked remote. |
| `maxJobs` | `50` | 1–500. |

### `search_google_ads`

Reads live and recent ads from the public [Google Ads Transparency Center](https://adstransparency.google.com).

| Parameter | Default | Description |
| --- | --- | --- |
| `targets` | required | 1–10 domains (`"stripe.com"`), advertiser IDs, or Transparency Center URLs. |
| `region` | `"ALL"` | ISO-2 country code (`"US"`, `"GB"`, `"FR"`). |
| `format` | `"ALL"` | `TEXT`, `IMAGE`, or `VIDEO`. |
| `dateRangeDays` | `30` | `0` = all history. |
| `minActiveDays` | — | Minimum active duration in days (e.g. `30` for evergreen winning ads). |
| `includeDetails` | `false` | Fetch per-ad EU DSA impression ranges (`euImpressionsMin`/`Max`), `countriesShown`, and flattened targeting flags. |
| `maxAdsPerTarget` | `20` | 1–100. |

### `get_telegram_channel_posts`

Reads posts from public Telegram channels via Telegram's public web preview. No Telegram account, bot token, or phone number required.

| Parameter | Default | Description |
| --- | --- | --- |
| `channels` | required | 1–10 usernames or URLs: `"durov"`, `"@telegram"`, `"https://t.me/bloomberg"`. |
| `maxPostsPerChannel` | `30` | 1–200, newest first. |
| `sinceDate` | `""` | `YYYY-MM-DD`; older posts are skipped. |
| `keywords` | `[]` | Return only posts containing any of these words, hashtags, or cashtags. |
| `minViews` | — | Optional minimum view count filter. |
| `excludeForwarded` | `false` | Skip reposted/forwarded posts and keep original posts only. |

Returns OSINT/finance fields (`externalDomains`, `mentions`, `tickers`, `cryptoAddresses`, `engagementRatePct`, `reactionsTotal`, `paidStars`) automatically.

### `verify_eu_company`

Validates EU VAT numbers against the European Commission's VIES service, enriches official company registries (France SIRENE, Switzerland Zefix, Norway Brreg, Finland PRH, GLEIF LEI), and screens companies + officers live against **US OFAC SDN/ALT, EU Financial Sanctions (FSF), and UN Security Council** lists.

| Parameter | Default | Description |
| --- | --- | --- |
| `queries` | required | 1–200 VAT numbers, French SIREN/SIRET, Swiss UID (`CHE-105.909.036`), Norwegian org numbers (`NO:923609016`), LEI codes, or company names. |
| `defaultCountry` | `""` | ISO-2 country code for plain company names. |
| `screenSanctions` | `true` | Screen resolved companies and extracted officers live against OFAC, EU FSF, and UN SC sanctions lists. |

`vatValid` is `null` when a member state's VIES endpoint is temporarily unavailable (meaning "retry later", not "invalid").

### `search_eu_tenders`

Searches European public procurement notices and contract awards across **EU TED**, **France BOAMP**, and **UK Find a Tender (OCDS)**.

| Parameter | Default | Description |
| --- | --- | --- |
| `sources` | `["EU_TED","FR_BOAMP","UK_FTS"]` | Official procurement portals to query. |
| `keywords` | `[]` | Optional OR-logic keywords (`["cloud", "cybersecurity"]`). |
| `countries` | `[]` | Optional ISO-2 country codes (`["FR", "DE", "GB"]`). |
| `cpvCodes` | `[]` | Optional 8-digit CPV codes (`["72000000"]`). |
| `noticeCategory` | `"ALL"` | `"ALL"`, `"OPEN_TENDER"`, `"CONTRACT_AWARD"` (with `winners` & `awardedValue`), or `"PLANNING"`. |
| `minValueEur` | — | Minimum contract value in approximate EUR equivalent. |
| `publishedSinceDays` | `14` | 1–365 days lookback. |
| `onlyOpenTenders` | `false` | Exclude tenders past their submission deadline. |
| `maxResultsPerSource` | `15` | 1–100 per enabled portal. |

### `get_run_results`

MCP clients typically time out after 60 seconds, so each tool waits at most 45 seconds. Larger queries return partial items with `finished: false` and a `runId`; the assistant then calls `get_run_results` with that `runId` at no extra charge.

## Structured output

Every tool declares an `outputSchema` and returns `structuredContent`:

```json
{ "actor": "clearstack-data/career-site-jobs-search", "runId": "…", "status": "SUCCEEDED", "finished": true, "itemCount": 3, "items": [] }
```

Empty and null fields are stripped from items to keep token usage low.

## Security and privacy

- `APIFY_TOKEN` is read from the local environment and sent only to `api.apify.com` via the `Authorization` header, never in a URL.
- Zero telemetry, zero files written to disk. Only one startup line is logged to `stderr`.
- All data comes from public sources (company career sites, Google Ads Transparency Center, Telegram public web preview, VIES, official business registries, government sanctions lists, and official EU/FR/UK procurement APIs).
- See [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

## Troubleshooting

| Message | Fix |
| --- | --- |
| `APIFY_TOKEN is not set` | Add the token to the `env` block of your client config and restart the client. |
| `HTTP 401` | The token is invalid or revoked. Generate a new one at [console.apify.com/settings/integrations](https://console.apify.com/settings/integrations). |
| `usage or spending limit` | Raise the spending limit or upgrade at [console.apify.com/billing](https://console.apify.com/billing). |
| `may not be public yet` | The Actor is not available to your account; open an issue. |
| `finished: false` | Normal for large searches: ask the model to call `get_run_results`. |

## Related tools

- [ATS Job Board Finder](https://wordhalm.github.io/ats-job-board-finder/) — free static search over the 25,787-employer ATS index (Greenhouse, Lever, Ashby, SmartRecruiters).
- [ClearStack Data Automation Templates](https://github.com/Wordhalm/clearstack-data-automation-templates) — ready-to-import n8n workflows and Clay recipes for these Actors.
- [ClearStack Data on Apify Store](https://apify.com/clearstack-data) — all 6 published Actors.

## Development

```bash
npm install                 # dev tools require Node 22+
npm test                    # unit tests against real Actor output fixtures
node scripts/smoke.mjs      # stdio handshake check, no token needed
npm run e2e                 # one live call per tool (requires APIFY_TOKEN, under $0.05)
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT. Not affiliated with Greenhouse, Lever, Ashby, SmartRecruiters, Google, Telegram, or the European Commission.
