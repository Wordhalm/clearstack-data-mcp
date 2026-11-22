# Changelog

## 0.2.0 (unreleased)

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
