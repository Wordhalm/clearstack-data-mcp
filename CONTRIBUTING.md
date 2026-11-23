# Contributing

Issues and pull requests are welcome.

## Local Setup

Requirements: Node.js 22+ for development (`Node 20+` at runtime).

```bash
npm install
npm test
node scripts/smoke.mjs
```

To run live end-to-end checks against Apify (costs under $0.05 on your own account):

```bash
APIFY_TOKEN=your_token npm run e2e
```

## Guidelines

- Keep tool schemas concise and backward-compatible.
- Add or update unit tests in `tests/` for any behavior change.
- Run `npm run build` and `npm test` before opening a pull request.
- Never commit API tokens or `.env` files.
