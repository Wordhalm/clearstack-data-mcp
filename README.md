# ClearStack Data MCP server

[![CI](https://github.com/Wordhalm/clearstack-data-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Wordhalm/clearstack-data-mcp/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/clearstack-data-mcp.svg)](https://www.npmjs.com/package/clearstack-data-mcp)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Four research tools for Claude, Cursor, VS Code and any other MCP client:

| Tool | Answers questions like | Cost per call |
| --- | --- | --- |
| `search_ats_jobs` | "Which of Datadog, Snowflake and Databricks are hiring data engineers in Europe?" | $0.002 + $0.0015 per job |
| `search_google_ads` | "What Google Ads has notion.so run in the UK over the last 30 days?" | $0.002 + $0.0012 per ad |
| `get_telegram_channel_posts` | "Summarise this week's posts from t.me/durov." | $0.002 + $0.0015 per post |
| `verify_eu_company` | "Is FR22424761419 a valid VAT number, and which company is it?" | $0.004 per company |

A fifth tool, `get_run_results`, collects the rest of a search that took longer than 45 seconds.

Each tool runs a [ClearStack Data](https://apify.com/clearstack-data) Actor on [Apify](https://apify.com) with **your own Apify API token**. Costs are billed by Apify to your account; Apify's free plan is enough to try every tool. Every call sends Apify a spending cap, so a call never costs more than the price above for the number of results you asked for.

## Install

You need Node.js 20 or later and an Apify API token from [console.apify.com/settings/integrations](https://console.apify.com/settings/integrations).

### Claude Code

```
claude mcp add clearstack-data -e APIFY_TOKEN=your_token -- npx -y clearstack-data-mcp
```

### Claude Desktop

Download the `.mcpb` bundle from the [latest GitHub Release](https://github.com/Wordhalm/clearstack-data-mcp/releases/latest) and open it with Claude Desktop, or go to Settings → Developer → Edit Config and add:

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

### Cursor and Windsurf

Same block as Claude Desktop, in `.cursor/mcp.json` (Cursor) or `~/.codeium/windsurf/mcp_config.json` (Windsurf).

### VS Code

`.vscode/mcp.json` (VS Code asks for the token once and stores it securely):

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

## Tools

### `search_ats_jobs`

Open roles read directly from company career sites on Greenhouse, Lever, Ashby and SmartRecruiters (25,787 employers indexed; look one up at [ATS Job Board Finder](https://wordhalm.github.io/ats-job-board-finder/)).

| Parameter | Default | |
| --- | --- | --- |
| `companies` | `[]` | Names (`"Stripe"`), `ats:slug` pairs (`"ashby:openai"`) or job board URLs. Empty: 35 well-known tech and AI employers. |
| `keywords` | `[]` | Match any of them in title or department. |
| `location` | `""` | Substring of the location: `"London"`, `"Remote"`, `"Germany"`. |
| `remoteOnly` | `false` | |
| `maxJobs` | `50` | 1–500. |

```json
{"company":"Airbnb","ats":"greenhouse","title":"Account Executive (Hotels)","location":"Barcelona, Spain","isRemote":false,"publishedAt":"2026-11-10","applyUrl":"https://careers.airbnb.com/positions/8365363?gh_jid=8365363"}
```

### `search_google_ads`

Ads from the public [Google Ads Transparency Center](https://adstransparency.google.com).

| Parameter | Default | |
| --- | --- | --- |
| `targets` | required | 1–10 domains (`"stripe.com"`), advertiser IDs or Transparency Center URLs. |
| `region` | `"ALL"` | ISO-2 country code. |
| `format` | `"ALL"` | `TEXT`, `IMAGE` or `VIDEO`. |
| `dateRangeDays` | `30` | 0 = all history. |
| `maxAdsPerTarget` | `20` | 1–100. |

```json
{"target":"stripe.com","advertiserName":"Stripe, Inc.","advertiserId":"AR16951989901585285121","creativeId":"CR13805501473330561025","format":"TEXT","firstShownDate":"2026-07-31","lastShownDate":"2026-11-22","variationsCount":114,"adUrl":"https://adstransparency.google.com/advertiser/AR16951989901585285121/creative/CR13805501473330561025"}
```

### `get_telegram_channel_posts`

Posts from public channels, read from Telegram's public web preview. No Telegram account or phone number.

| Parameter | Default | |
| --- | --- | --- |
| `channels` | required | 1–10 usernames or URLs: `"durov"`, `"@telegram"`, `"https://t.me/bloomberg"`. |
| `maxPostsPerChannel` | `30` | 1–200, newest first. |
| `sinceDate` | `""` | `YYYY-MM-DD`; older posts are skipped. |
| `keywords` | `[]` | Only posts containing any of them. |

```json
{"channel":"durov","channelTitle":"Pavel Durov","channelSubscribersNum":9910000,"messageId":568,"postUrl":"https://t.me/durov/568","publishedAt":"2026-11-21T22:48:52+00:00","text":"You won't look professional in 2027 if your QR is unpimped.","viewsNum":242000,"hasPhoto":false,"hasVideo":true,"hasDocument":false,"reactionsTotal":8870,"paidStars":1120}
```

`paidStars` is the number of Telegram Stars paid as reactions; it is not added to `reactionsTotal`.

### `verify_eu_company`

VAT check against the European Commission's VIES service, plus the official registry record from France (SIRENE), Switzerland (Zefix), Norway (Brreg), Finland (PRH) and GLEIF.

| Parameter | Default | |
| --- | --- | --- |
| `queries` | required | 1–200 VAT numbers, French SIREN/SIRET, Swiss UID (`CHE-105.909.036`), Norwegian org numbers (`NO:923609016`). |
| `defaultCountry` | `""` | ISO-2 country for plain company names. |

```json
{"query":"FR22424761419","found":true,"kybStatus":"VERIFIED_ACTIVE","country":"FR","legalName":"OVH (OVHCLOUD)","registrationNumber":"424761419","vatNumber":"FR22424761419","vatValid":true,"leiCode":"9695007586GCAKPYJ703","status":"ACTIVE","incorporationDate":"1999-10-15","address":{"full":"2 RUE KELLERMANN 59100 ROUBAIX"}}
```

`vatValid` is `null` when VIES could not give a verdict (a member state's service is often busy). That means "check again later", not "invalid".

### `get_run_results`

MCP clients usually stop waiting after 60 seconds, so each tool waits at most 45 seconds. A larger search returns the results found so far with `finished: false` and a `runId`; the model then calls `get_run_results` with that `runId`. No extra charge.

## Structured output

Every tool returns `structuredContent` matching its declared `outputSchema`:

```json
{ "actor": "clearstack-data/career-site-jobs-search", "runId": "…", "status": "SUCCEEDED", "finished": true, "itemCount": 3, "items": [] }
```

Empty fields are dropped from items to save tokens.

## Security and privacy

- The token is read from the `APIFY_TOKEN` environment variable and sent only to `api.apify.com`, in an `Authorization` header, never in a URL.
- No telemetry, nothing written to disk. The only log line goes to stderr at startup.
- All data comes from public sources: company career sites, Google's Ads Transparency Center, Telegram's public web preview, VIES and official company registries.

## Troubleshooting

| Message | Fix |
| --- | --- |
| `APIFY_TOKEN is not set` | Add the token to the `env` block of your client config and restart the client. |
| `HTTP 401` | The token is wrong or was revoked. |
| `usage or spending limit` | Raise the limit or upgrade at [console.apify.com/billing](https://console.apify.com/billing). |
| `may not be public yet` | The Actor is not available to your account; open an issue. |
| `finished: false` | Normal for large searches: ask the model to call `get_run_results`. |

## Compared with Apify's own MCP server

[Apify's MCP server](https://github.com/apify/apify-mcp-server) can load these Actors too (`https://mcp.apify.com?tools=clearstack-data/career-site-jobs-search`) and exposes their full input schemas. This server wraps them with fewer parameters, trims the output, caps spending on every call and handles long runs. Use whichever fits your client.

## Development

```
npm install                 # dev tools need Node 22+
npm test                    # unit tests on real Actor output
node scripts/smoke.mjs      # stdio check, no token needed
npm run e2e                 # one real call per tool (APIFY_TOKEN set), under $0.05
npm run pack:mcpb           # build the Claude Desktop bundle
```

## License

MIT. Not affiliated with Greenhouse, Lever, Ashby, SmartRecruiters, Google, Telegram or the European Commission.
