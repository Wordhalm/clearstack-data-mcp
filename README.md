# clearstack-data-mcp

MCP server that gives Claude, Cursor and other MCP clients four B2B research tools:

| Tool | What it returns | Price per call (billed by Apify to your account) |
| --- | --- | --- |
| `search_ats_jobs` | Open roles read from company career sites on Greenhouse, Lever, Ashby and SmartRecruiters (25,787 employers indexed) | $0.002 + $1.50 per 1,000 jobs |
| `search_google_ads` | Ads a company runs on Google, from the public Google Ads Transparency Center | $0.002 + $1.20 per 1,000 ads |
| `get_telegram_channel_posts` | Recent posts from public Telegram channels, no Telegram account needed | $0.002 + $1.50 per 1,000 posts |
| `verify_eu_company` | EU VAT validation (VIES) and official registry record (France SIRENE, Swiss Zefix, Norway Brreg, Finland PRH, GLEIF LEI) | $4.00 per 1,000 companies |

Each tool runs a [ClearStack Data](https://apify.com/clearstack-data) Actor on Apify with your own API token. There is no other backend and nothing is logged by this package. Apify has a free plan, which is enough to try every tool.

Example prompts:

- "Which of Datadog, Snowflake and Databricks are hiring data engineers in Europe right now?"
- "List remote AI engineer roles at Anthropic, OpenAI and Linear."
- "What Google Ads has notion.so run in the UK over the last 30 days?"
- "Summarise this week's posts from t.me/durov."
- "Is FR22424761419 a valid VAT number, and what company is it?"

## Setup

1. Copy your Apify API token from https://console.apify.com/settings/integrations.
2. Add the server to your client.

**Claude Code**

```
claude mcp add clearstack-data -e APIFY_TOKEN=your_token -- npx -y github:Wordhalm/clearstack-data-mcp
```

**Claude Desktop, Cursor, Windsurf** (`claude_desktop_config.json`, `.cursor/mcp.json`, …)

```json
{
  "mcpServers": {
    "clearstack-data": {
      "command": "npx",
      "args": ["-y", "github:Wordhalm/clearstack-data-mcp"],
      "env": { "APIFY_TOKEN": "your_token" }
    }
  }
}
```

Requires Node.js 18 or later. The first start takes a minute: npx downloads the repository and builds it.

## Cost control

- Every tool has a result cap (`maxJobs`, `maxAdsPerTarget`, `maxPostsPerChannel`, or the number of queries). The server turns it into Apify's `maxTotalChargeUsd`, so a call cannot cost more than the cap times the listed price.
- Runs wait up to 120 seconds. Large requests are better run on a schedule from the Actor pages on Apify.

## Why not the generic Apify MCP server?

[Apify's own MCP server](https://github.com/apify/apify-mcp-server) can load these Actors too (`?tools=clearstack-data/career-site-jobs-search,…`) and exposes their full input schemas. This package wraps them with fewer, plainer parameters, drops output fields a model rarely needs, and sets a spending cap on every call. Use whichever suits your client.

## Development

```
npm install
npm run build
npm test
```

## License

MIT. Not affiliated with Greenhouse, Lever, Ashby, SmartRecruiters, Google or Telegram.
