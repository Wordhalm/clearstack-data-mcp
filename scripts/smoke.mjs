// Starts the built server over stdio, lists tools and checks the missing-token error. No network, no token.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const env = { ...process.env };
delete env.APIFY_TOKEN;
const transport = new StdioClientTransport({
    command: process.execPath,
    args: [new URL('../dist/index.js', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')],
    env,
});
const client = new Client({ name: 'smoke', version: '0' });
await client.connect(transport);
const { tools } = await client.listTools();
const res = await client.callTool({ name: 'verify_eu_company', arguments: { queries: ['FR22424761419'] } });
await client.close();
const ok = tools.length === 5 && res.isError && res.content[0].text.includes('APIFY_TOKEN is not set');
console.log(`node ${process.version}: ${tools.length} tools, missing-token error ${res.isError ? 'ok' : 'missing'}`);
process.exit(ok ? 0 : 1);
