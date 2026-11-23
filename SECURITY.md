# Security Policy

## Supported Versions

Only the latest published minor release on npm (`clearstack-data-mcp`) receives security fixes.

## Security Model

- `APIFY_TOKEN` is read exclusively from the process environment (`process.env.APIFY_TOKEN`) and sent only to `https://api.apify.com` in an `Authorization: Bearer` header. It is never placed in URLs, written to disk, or logged.
- Every tool is read-only (`readOnlyHint: true`, `destructiveHint: false`, `openWorldHint: true`) and enforces a per-call Apify spending cap (`maxTotalChargeUsd`).
- No telemetry, analytics, or third-party endpoints beyond `api.apify.com`.

## Reporting a Vulnerability

Please report security issues privately using GitHub Security Advisories on this repository (`Security` -> `Advisories` -> `New draft security advisory`), or open a minimal issue requesting a private channel if advisories are unavailable. Include reproduction steps and affected versions.
