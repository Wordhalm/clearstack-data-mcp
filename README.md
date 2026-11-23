# ClearStack Data MCP Server

[![CI](https://github.com/Wordhalm/clearstack-data-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Wordhalm/clearstack-data-mcp/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/clearstack-data-mcp.svg)](https://www.npmjs.com/package/clearstack-data-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP_Registry-published-2ea44f)](https://registry.modelcontextprotocol.io/v0.1/servers?search=clearstack-data-mcp)
[![Glama MCP server](https://glama.ai/mcp/servers/Wordhalm/clearstack-data-mcp/badges/score.svg)](https://glama.ai/mcp/servers/Wordhalm/clearstack-data-mcp)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Live B2B research tools for **Claude Code**, **Claude Desktop**, **Cursor**, **Windsurf**, and **VS Code**: career-site job openings across 25,787 employers, Google Ads Transparency Center, public Telegram channels, and EU VAT/company registry verification.

[<img src="https://cursor.com/deeplink/mcp-install-dark.svg" alt="Install in Cursor" height="32">](https://cursor.com/en/install-mcp?name=clearstack-data&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsImNsZWFyc3RhY2stZGF0YS1tY3AiXSwiZW52Ijp7IkFQSUZZX1RPS0VOIjoiWU9VUl9BUElGWV9UT0tFTiJ9fQ%3D%3D)
[<img src="https://img.shields.io/badge/VS_Code-Install_MCP-0098FF?style=for-the-badge&logo=visualstudiocode&logoColor=white" alt="Install in VS Code" height="32">](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522clearstack-data%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522-y%2522%252C%2522clearstack-data-mcp%2522%255D%252C%2522env%2522%253A%257B%2522APIFY_TOKEN%2522%253A%2522%2524%257Binput%253Aapify-token%257D%2522%257D%252C%2522inputs%2522%253A%255B%257B%2522type%2522%253A%2522promptString%2522%252C%2522id%2522%253A%2522apify-token%2522%252C%2522description%2522%253A%2522Apify%2520API%2520token%2522%252C%2522password%2522%253Atrue%257D%255D%257D)

```bash
claude mcp add clearstack-data -e APIFY_TOKEN=your_token -- npx -y clearstack-data-mcp
```

## What it does

| Tool | Data source | Typical question | Cost on Apify |
| --- | --- | --- | --- |
| `search_ats_jobs` | Greenhouse, Lever, Ashby, SmartRecruiters (25,787 employers) | "Which of Datadog, Snowflake and Databricks are hiring data engineers in Europe?" | $0.002 + $0.0015 / job |
| `search_google_ads` | Google Ads Transparency Center (Search, Display, YouTube) | "What Google Ads has notion.so run in the UK over the last 30 days?" | $0.002 + $0.0012 / ad |
| `get_telegram_channel_posts` | Public Telegram channels (no Telegram account required) | "Summarise this week's posts from t.me/durov." | $0.002 + $0.0015 / post |
| `verify_eu_company` | EU VIES VAT + SIRENE (FR), Zefix (CH), Brreg (NO), PRH (FI), GLEIF LEI | "Is FR22424761419 a valid VAT number, and which company is it?" | $0.004 / company |
| `get_run_results` | Any in-progress Apify run from the four tools above | Automatically called when a large query exceeds 45 seconds | Free (already paid) |

Each tool calls a [ClearStack Data](https://apify.com/clearstack-data) Actor on [Apify](https://apify.com) using **your own `APIFY_TOKEN`**.
- **Free to try**: Apify's free tier includes monthly platform credits (no credit card required), which is enough for hundreds to thousands of calls.
- **Hard spending cap**: every call passes Apify's `maxTotalChargeUsd`, calculated from the item limit you requested.
- **Read-only & local**: all tools are annotated `readOnlyHint: true`, send your token only to `api.apify.com`, and write nothing to disk.

## Example prompts

Paste any of these into Claude, Cursor, or VS Code after installing:

- **Account hiring signals (B2B sales / GTM)**: *"Check if Stripe, Datadog, and Linear are hiring for RevOps or Data Engineering roles in Europe, and give me the direct apply URLs."*
- **Competitor ad teardown**: *"Pull the last 30 days of Google Ads for notion.so and monday.com in the US, grouped by format (TEXT, IMAGE, VIDEO), and highlight which campaigns ran longest."*
- **EU vendor KYB / onboarding check**: *"Verify VAT numbers FR22424761419 and CHE-105.909.036, check whether each company is active, and list their legal name, registration number, and registered address."*
- **Telegram market watch**: *"Fetch the last 20 posts from t.me/durov and t.me/telegram mentioning AI or Stars, sorted by views."*

## Install

Requirements: **Node.js 20+** and an Apify API token from [console.apify.com/settings/integrations](https://console.apify.com/settings/integrations).

### Claude Code

```bash
claude mcp add clearstack-data -e APIFY_TOKEN=your_token -- npx -y clearstack-data-mcp
```

### Cursor

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

### Claude Desktop and Windsurf

In Claude Desktop (`Settings -> Developer -> Edit Config`) or Windsurf (`~/.codeium/windsurf/mcp_config.json`), add the same `mcpServers` block as Cursor above.

### VS Code

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

Reads live openings directly from company career sites on Greenhouse, Lever, Ashby, and SmartRecruiters (25,787 employers indexed; browse or look up ATS slugs with [ATS Job Board Finder](https://wordhalm.github.io/ats-job-board-finder/)).

| Parameter | Default | Description |
| --- | --- | --- |
| `companies` | `[]` | Names (`"Stripe"`), `ats:slug` pairs (`"ashby:openai"`), or job board URLs. Empty scans 35 well-known tech and AI employers. |
| `keywords` | `[]` | Match any of them in title or department. |
| `location` | `""` | Substring of the location: `"London"`, `"Remote"`, `"Germany"`. |
| `remoteOnly` | `false` | Return only roles marked remote. |
| `maxJobs` | `50` | 1–500. |

```json
{"company":"Airbnb","ats":"greenhouse","title":"Account Executive (Hotels)","location":"Barcelona, Spain","isRemote":false,"publishedAt":"2026-11-10","applyUrl":"https://careers.airbnb.com/positions/8365363?gh_jid=8365363"}
```

### `search_google_ads`

Reads live and recent ads from the public [Google Ads Transparency Center](https://adstransparency.google.com).

| Parameter | Default | Description |
| --- | --- | --- |
| `targets` | required | 1–10 domains (`"stripe.com"`), advertiser IDs, or Transparency Center URLs. |
| `region` | `"ALL"` | ISO-2 country code (`"US"`, `"GB"`, `"FR"`). |
| `format` | `"ALL"` | `TEXT`, `IMAGE`, or `VIDEO`. |
| `dateRangeDays` | `30` | `0` = all history. |
| `maxAdsPerTarget` | `20` | 1–100. |

```json
{"target":"stripe.com","advertiserName":"Stripe, Inc.","advertiserId":"AR16951989901585285121","creativeId":"CR13805501473330561025","format":"TEXT","firstShownDate":"2026-07-31","lastShownDate":"2026-11-22","variationsCount":114,"adUrl":"https://adstransparency.google.com/advertiser/AR16951989901585285121/creative/CR13805501473330561025"}
```

### `get_telegram_channel_posts`

Reads posts from public Telegram channels via Telegram's public web preview. No Telegram account, bot token, or phone number required.

| Parameter | Default | Description |
| --- | --- | --- |
| `channels` | required | 1–10 usernames or URLs: `"durov"`, `"@telegram"`, `"https://t.me/bloomberg"`. |
| `maxPostsPerChannel` | `30` | 1–200, newest first. |
| `sinceDate` | `""` | `YYYY-MM-DD`; older posts are skipped. |
| `keywords` | `[]` | Return only posts containing any of these keywords. |

```json
{"channel":"durov","channelTitle":"Pavel Durov","channelSubscribersNum":9910000,"messageId":568,"postUrl":"https://t.me/durov/568","publishedAt":"2026-11-21T22:48:52+00:00","text":"You won't look professional in 2027 if your QR is unpimped.","viewsNum":242000,"hasPhoto":false,"hasVideo":true,"hasDocument":false,"reactionsTotal":8870,"paidStars":1120}
```

`paidStars` reports Telegram Stars paid as reactions separately from `reactionsTotal`.

### `verify_eu_company`

Validates EU VAT numbers against the European Commission's VIES service and enriches from official company registries: France (SIRENE), Switzerland (Zefix), Norway (Brreg), Finland (PRH), and GLEIF LEI.

| Parameter | Default | Description |
| --- | --- | --- |
| `queries` | required | 1–200 VAT numbers, French SIREN/SIRET, Swiss UID (`CHE-105.909.036`), or Norwegian org numbers (`NO:923609016`). |
| `defaultCountry` | `""` | ISO-2 country code for plain company names. |

```json
{"query":"FR22424761419","found":true,"kybStatus":"VERIFIED_ACTIVE","country":"FR","legalName":"OVH (OVHCLOUD)","registrationNumber":"424761419","vatNumber":"FR22424761419","vatValid":true,"leiCode":"9695007586GCAKPYJ703","status":"ACTIVE","incorporationDate":"1999-10-15","address":{"full":"2 RUE KELLERMANN 59100 ROUBAIX"}}
```

`vatValid` is `null` when a member state's VIES endpoint is temporarily unavailable (meaning "retry later", not "invalid").

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
- All data comes from public sources (company career sites, Google Ads Transparency Center, Telegram public web preview, VIES, official business registries).
- See [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

## Troubleshooting

| Message | Fix |
| --- | --- |
| `APIFY_TOKEN is not set` | Add the token to the `env` block of your client config and restart the client. |
| `HTTP 401` | The token is invalid or revoked. Generate a new one at [console.apify.com/settings/integrations](https://console.apify.com/settings/integrations). |
| `usage or spending limit` | Raise the spending limit or upgrade at [console.apify.com/billing](https://console.apify.com/billing). |
| `may not be public yet` | The Actor is not available to your account; open an issue. |
| `finished: false` | Normal for large searches: ask the model to call `get_run_results`. |

## Compared with Apify's official MCP server

[Apify's MCP server](https://github.com/apify/apify-mcp-server) can load these Actors directly (`https://mcp.apify.com?tools=clearstack-data/career-site-jobs-search`) with their full input schemas. This package wraps them with focused parameters, trimmed token-efficient outputs, automatic `maxTotalChargeUsd` spending caps, and 45-second timeout pagination.

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
