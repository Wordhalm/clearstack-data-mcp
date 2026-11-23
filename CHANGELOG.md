# Changelog

## 0.2.2 (2026-11-24)

- Documented every input parameter across all 5 tools (100% schema coverage, adding descriptions to `format` and `maxAdsPerTarget` in `search_google_ads`).
- Added explicit when-to-use / exclusions, cost-scaling, timeout, and error-handling guidance to every tool description.
- Added GitHub Dependabot (`.github/dependabot.yml`) and CodeQL code scanning (`.github/workflows/codeql.yml`).

## 0.2.1 (2026-11-23)

- Added logo to README, Official MCP Registry `server.json` (`icons` and `websiteUrl`), and Cursor plugin manifest (`.cursor-plugin/plugin.json`, `.mcp.json`, and `rules/clearstack-b2b-signals.mdc`).
- Updated npm README with 1-click Cursor and VS Code install buttons, example prompts, `SECURITY.md`, `CONTRIBUTING.md`, and `llms.txt`.

## 0.2.0 (2026-11-23)

- Runs start asynchronously and wait at most 45 s per call (MCP clients usually time out at 60 s). Longer runs return partial results with `finished: false`; the new `get_run_results` tool collects the rest, with the same item cap as the original call.
- Every tool declares an `outputSchema` and returns `structuredContent`.
- Spending cap on every call through Apify's `maxTotalChargeUsd`.
- Progress notifications while a run is going, for clients that send a progress token.
- Server instructions telling the model which tool fits which question.
- Telegram: `reactionsTotal` and `paidStars` instead of the raw reaction list.
- Clearer errors for 401, spending limits, unpublished Actors and failed runs (with a link to the run log). A run that times out or is aborted still returns the items it pushed.
- Claude Desktop bundle (`.mcpb`), `server.json` for the MCP Registry, `glama.json`.
- CI on Linux, Windows and macOS.

## 0.1.0

- First version: four tools calling Apify's run-sync endpoint.
