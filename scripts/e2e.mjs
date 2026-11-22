// End-to-end check against the real Apify API. Needs APIFY_TOKEN in the environment.
// Runs each tool once with tiny inputs; total cost on your Apify account is under $0.05.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

if (!process.env.APIFY_TOKEN) {
    console.error('Set APIFY_TOKEN first.');
    process.exit(1);
}
const transport = new StdioClientTransport({
    command: process.execPath,
    args: [new URL('../dist/index.js', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')],
    env: { ...process.env },
});
const client = new Client({ name: 'e2e', version: '0' });
await client.connect(transport);

const cases = [
    ['search_ats_jobs', { companies: ['Linear'], maxJobs: 5 }],
    ['search_google_ads', { targets: ['stripe.com'], maxAdsPerTarget: 3 }],
    ['get_telegram_channel_posts', { channels: ['durov'], maxPostsPerChannel: 3 }],
    ['verify_eu_company', { queries: ['FR22424761419'] }],
];
let failed = 0;
for (const [name, args] of cases) {
    const t0 = Date.now();
    const res = await client.callTool({ name, arguments: args }, undefined, { timeout: 70_000 });
    const s = res.structuredContent;
    const ok = !res.isError && s && s.itemCount > 0;
    if (!ok) failed++;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${name.padEnd(28)} ${((Date.now() - t0) / 1000).toFixed(1)}s  items=${s?.itemCount ?? 0}  finished=${s?.finished ?? '-'}  ${res.isError ? res.content[0].text.slice(0, 120) : ''}`);
}
await client.close();
process.exit(failed ? 1 : 0);
