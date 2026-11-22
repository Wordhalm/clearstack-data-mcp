import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it, vi } from 'vitest';
import { createServer } from '../src/server.js';

async function connect(opts: Parameters<typeof createServer>[0]) {
    const server = createServer(opts);
    const client = new Client({ name: 'test', version: '0.0.0' });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(a), client.connect(b)]);
    return client;
}

const text = (r: unknown) => ((r as { content: Array<{ text: string }> }).content[0]?.text ?? '');

describe('clearstack-data MCP server', () => {
    it('lists the four tools', async () => {
        const client = await connect({ token: 't' });
        const { tools } = await client.listTools();
        expect(tools.map((t) => t.name).sort()).toEqual(
            ['get_telegram_channel_posts', 'search_ats_jobs', 'search_google_ads', 'verify_eu_company'],
        );
        for (const t of tools) expect(t.annotations?.readOnlyHint).toBe(true);
    });

    it('runs the jobs Actor with the bearer token and trims fields', async () => {
        const fetchImpl = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
            new Response(JSON.stringify([
                { company: 'Stripe', ats: 'greenhouse', title: 'AI Engineer', location: 'Remote', isRemote: true, applyUrl: 'https://x', jobId: 'gh:1', fetchedAt: 'z' },
            ]), { status: 200 }),
        );
        const client = await connect({ token: 'secret-token', fetchImpl: fetchImpl as unknown as typeof fetch });
        const res = await client.callTool({ name: 'search_ats_jobs', arguments: { companies: ['Stripe'], keywords: ['AI'], maxJobs: 10 } });

        const [url, init] = fetchImpl.mock.calls[0]!;
        expect(String(url)).toBe(
            'https://api.apify.com/v2/acts/clearstack-data~career-site-jobs-search/run-sync-get-dataset-items?timeout=120&maxItems=10&maxTotalChargeUsd=0.0170&format=json&clean=true',
        );
        expect(String(url)).not.toContain('secret-token');
        expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer secret-token');
        expect(JSON.parse(String(init!.body))).toMatchObject({ companies: ['Stripe'], keywords: ['AI'], maxJobsTotal: 10, remoteOnly: false });
        expect(res.isError).toBeFalsy();
        expect(text(res)).toContain('"title": "AI Engineer"');
        expect(text(res)).not.toContain('jobId');
    });

    it('returns a readable error when APIFY_TOKEN is missing', async () => {
        const client = await connect({});
        const res = await client.callTool({ name: 'verify_eu_company', arguments: { queries: ['FR22424761419'] } });
        expect(res.isError).toBe(true);
        expect(text(res)).toContain('APIFY_TOKEN is not set');
    });

    it('surfaces Apify API errors', async () => {
        const fetchImpl = vi.fn(async () =>
            new Response(JSON.stringify({ error: { type: 'not-enough-usage', message: 'Monthly usage limit reached' } }), { status: 402 }),
        );
        const client = await connect({ token: 't', fetchImpl: fetchImpl as unknown as typeof fetch });
        const res = await client.callTool({ name: 'search_google_ads', arguments: { targets: ['stripe.com'] } });
        expect(res.isError).toBe(true);
        expect(text(res)).toBe('Apify returned HTTP 402: Monthly usage limit reached');
    });
});
