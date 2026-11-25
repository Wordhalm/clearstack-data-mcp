import { readFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';
import { spendCap } from '../src/apify.js';
import { createServer, type ServerOptions } from '../src/server.js';

// Real dataset items captured from the published Actors (first 3 items of a default call).
const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf-8')) as Record<string, unknown>[];

interface Call { method: string; url: string; headers: Record<string, string>; body?: unknown }

/**
 * Fake Apify API: POST /acts/.../runs starts a run, GET /actor-runs/:id returns the next status
 * from `statuses`, GET /datasets/:id/items returns `items`.
 */
function fakeApify(items: Record<string, unknown>[], statuses: string[] = ['SUCCEEDED'], startStatus = 'RUNNING') {
    const calls: Call[] = [];
    let i = 0;
    const run = (status: string) => ({ data: { id: 'run123', actId: 'act1', status, defaultDatasetId: 'ds1' } });
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        calls.push({ method: init?.method ?? 'GET', url, headers: init?.headers as Record<string, string>, body: init?.body ? JSON.parse(String(init.body)) : undefined });
        if (url.includes('/runs?')) return new Response(JSON.stringify(run(startStatus)), { status: 201 });
        if (url.includes('/actor-runs/')) return new Response(JSON.stringify(run(statuses[Math.min(i++, statuses.length - 1)]!)), { status: 200 });
        if (url.includes('/datasets/')) return new Response(JSON.stringify(items), { status: 200 });
        return new Response('{}', { status: 404 });
    }) as typeof fetch;
    return { calls, fetchImpl };
}

async function connect(opts: ServerOptions) {
    const server = createServer({ pollSecs: 1, maxWaitSecs: 2, ...opts });
    const client = new Client({ name: 'test', version: '0.0.0' });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(a), client.connect(b)]);
    return client;
}

type Result = { content: Array<{ text: string }>; structuredContent?: { items: Record<string, unknown>[]; finished: boolean; runId: string; itemCount: number }; isError?: boolean };
const text = (r: unknown) => (r as Result).content[0]?.text ?? '';

describe('tool list', () => {
    it('exposes six read-only tools with output schemas', async () => {
        const client = await connect({ token: 't' });
        const { tools } = await client.listTools();
        expect(tools.map((t) => t.name).sort()).toEqual(
            ['get_run_results', 'get_telegram_channel_posts', 'search_ats_jobs', 'search_eu_tenders', 'search_google_ads', 'verify_eu_company'],
        );
        for (const t of tools) {
            expect(t.annotations?.readOnlyHint).toBe(true);
            expect(t.outputSchema?.properties).toHaveProperty('items');
            expect(t.description!.length).toBeGreaterThan(80);
        }
        expect(client.getInstructions()).toContain('get_run_results');
        expect(client.getInstructions()).toContain('search_eu_tenders');
    });
});

describe('runs on real Actor output', () => {
    it('search_ats_jobs: token in header only, spend cap, trimmed fields', async () => {
        const { calls, fetchImpl } = fakeApify(fixture('jobs'));
        const client = await connect({ token: 'secret-token', fetchImpl });
        const res = (await client.callTool({ name: 'search_ats_jobs', arguments: { companies: ['Stripe'], keywords: ['AI'], maxJobs: 10 } })) as Result;

        expect(res.isError).toBeFalsy();
        const start = calls[0]!;
        expect(start.method).toBe('POST');
        expect(start.url).toBe(
            'https://api.apify.com/v2/acts/clearstack-data~career-site-jobs-search/runs?timeout=300&maxItems=10&maxTotalChargeUsd=0.021&waitForFinish=0',
        );
        for (const c of calls) {
            expect(c.url).not.toContain('secret-token');
            expect(c.headers.Authorization).toBe('Bearer secret-token');
        }
        expect(start.body).toMatchObject({ companies: ['Stripe'], keywords: ['AI'], maxJobsTotal: 10, remoteOnly: false });

        const items = res.structuredContent!.items;
        expect(items).toHaveLength(3);
        expect(Object.keys(items[0]!)).toEqual(expect.arrayContaining(['company', 'ats', 'title', 'location', 'isRemote', 'applyUrl']));
        expect(items[0]).not.toHaveProperty('jobId');
        expect(items[0]).not.toHaveProperty('department'); // null in the fixture, dropped
        expect(res.structuredContent!.finished).toBe(true);
    });

    it('search_google_ads keeps dates and URLs, drops timestamps', async () => {
        const { fetchImpl } = fakeApify(fixture('ads'));
        const client = await connect({ token: 't', fetchImpl });
        const res = (await client.callTool({ name: 'search_google_ads', arguments: { targets: ['stripe.com'] } })) as Result;
        const ad = res.structuredContent!.items[0]!;
        expect(ad).toHaveProperty('advertiserName');
        expect(ad).toHaveProperty('firstShownDate');
        expect(ad).toHaveProperty('adUrl');
        expect(ad).not.toHaveProperty('firstShownTimestamp');
        expect(ad).not.toHaveProperty('previewScriptUrl');
    });

    it('get_telegram_channel_posts sums reactions and keeps text', async () => {
        const raw = fixture('tg');
        const { calls, fetchImpl } = fakeApify(raw);
        const client = await connect({ token: 't', fetchImpl });
        const res = (await client.callTool({ name: 'get_telegram_channel_posts', arguments: { channels: ['durov'], maxPostsPerChannel: 5 } })) as Result;
        const post = res.structuredContent!.items[0]!;
        expect(post.text).toBe(raw[0]!.text);
        expect(post).toHaveProperty('postUrl');
        expect(post).not.toHaveProperty('reactions');
        const reactions = raw[0]!.reactions as Array<{ countNum: number; type: string }>;
        const sum = (paid: boolean) => reactions.filter((r) => (r.type === 'paid_stars') === paid).reduce((s, r) => s + r.countNum, 0);
        expect(reactions.some((r) => r.type === 'paid_stars')).toBe(true); // fixture comes from the fixed Actor
        expect(post.reactionsTotal).toBe(sum(false));
        expect(post.paidStars).toBe(sum(true));
    });

    it('reports paid Stars apart from reactions', async () => {
        const post = { channel: 'durov', messageId: 1, text: 'x', reactions: [
            { emoji: '⭐', type: 'paid_stars', countNum: 1000 },
            { emoji: 'custom:1', type: 'custom_emoji', countNum: 300 },
            { emoji: '👍', type: 'emoji', countNum: 20 },
        ] };
        const { calls, fetchImpl } = fakeApify([post]);
        const client = await connect({ token: 't', fetchImpl });
        const res = (await client.callTool({ name: 'get_telegram_channel_posts', arguments: { channels: ['durov'] } })) as Result;
        expect(res.structuredContent!.items[0]).toMatchObject({ reactionsTotal: 320, paidStars: 1000 });
        expect(calls[0]!.body).toMatchObject({ channels: ['durov'], maxMessagesPerChannel: 30 });
    });

    it('verify_eu_company returns registry, sanctions & risk flags fields', async () => {
        const enrichedKyb = fixture('kyb').map((item, i) =>
            i === 0 ? { ...item, kybRiskFlags: [], sanctions: { status: 'CLEAR', totalMatches: 0, matches: [] } } : item,
        );
        const { calls, fetchImpl } = fakeApify(enrichedKyb);
        const client = await connect({ token: 't', fetchImpl });
        const res = (await client.callTool({ name: 'verify_eu_company', arguments: { queries: ['FR22424761419', 'CHE-105.909.036', 'NO:923609016'] } })) as Result;
        expect(res.structuredContent!.itemCount).toBe(3);
        expect(res.structuredContent!.items[0]).toHaveProperty('legalName');
        expect(res.structuredContent!.items[0]).toHaveProperty('sanctions');
        expect(calls[0]!.url).toContain('maxTotalChargeUsd=0.015');
        expect(calls[0]!.body).toMatchObject({ screenSanctions: true });
    });

    it('search_eu_tenders forwards filters, applies spend cap, and keeps award fields', async () => {
        const { calls, fetchImpl } = fakeApify(fixture('tenders'));
        const client = await connect({ token: 't', fetchImpl });
        const res = (await client.callTool({
            name: 'search_eu_tenders',
            arguments: { sources: ['EU_TED', 'UK_FTS'], noticeCategory: 'CONTRACT_AWARD', minValueEur: 100000, maxResultsPerSource: 5 },
        })) as Result;
        expect(res.isError).toBeFalsy();
        expect(calls[0]!.url).toContain('clearstack-data~eu-public-tenders-monitor/runs?');
        expect(calls[0]!.url).toContain('maxItems=10');
        expect(calls[0]!.body).toMatchObject({
            sources: ['EU_TED', 'UK_FTS'],
            noticeCategory: 'CONTRACT_AWARD',
            minValueEur: 100000,
            maxResultsPerSource: 5,
        });
        expect(res.structuredContent!.itemCount).toBe(2);
        expect(res.structuredContent!.items[0]).toMatchObject({
            source: 'EU_TED',
            noticeCategory: 'CONTRACT_AWARD',
            awardedValue: 284062.5,
            winners: ['Rubin GmbH'],
        });
    });

    it('forwards v1.1 filters on search_ats_jobs, search_google_ads, and get_telegram_channel_posts', async () => {
        const jobCall = fakeApify([{ company: 'OpenAI', ats: 'ashby', title: 'Staff Engineer', workplaceType: 'hybrid', seniority: 'staff', salaryAnnualUsdMin: 250000, techStack: ['Python', 'Kubernetes'], applyUrl: 'https://jobs.ashbyhq.com/openai/1' }]);
        const c1 = await connect({ token: 't', fetchImpl: jobCall.fetchImpl });
        const r1 = (await c1.callTool({
            name: 'search_ats_jobs',
            arguments: { companies: ['OpenAI'], requiredSkills: ['k8s'], seniorityLevels: ['staff'], minSalaryUsd: 200000, maxJobs: 5 },
        })) as Result;
        expect(jobCall.calls[0]!.body).toMatchObject({ requiredSkills: ['k8s'], seniorityLevels: ['staff'], minSalaryUsd: 200000 });
        expect(r1.structuredContent!.items[0]).toMatchObject({ seniority: 'staff', salaryAnnualUsdMin: 250000, techStack: ['Python', 'Kubernetes'] });

        const adCall = fakeApify([{ target: 'shopify.com', advertiserName: 'Shopify', creativeId: 'CR1', format: 'TEXT', activeDays: 120, euImpressionsMin: 60000, euImpressionsMax: 70000, countriesShown: ['DE', 'FR'], euTargetingIncluded: ['location'] }]);
        const c2 = await connect({ token: 't', fetchImpl: adCall.fetchImpl });
        const r2 = (await c2.callTool({
            name: 'search_google_ads',
            arguments: { targets: ['shopify.com'], region: 'FR', minActiveDays: 30, includeDetails: true, maxAdsPerTarget: 5 },
        })) as Result;
        expect(adCall.calls[0]!.body).toMatchObject({ minActiveDays: 30, includeDetails: true });
        expect(r2.structuredContent!.items[0]).toMatchObject({ activeDays: 120, euImpressionsMin: 60000, countriesShown: ['DE', 'FR'] });

        const tgCall = fakeApify([{ channel: 'durov', messageId: 1, text: 'Watching $TON', viewsNum: 500000, engagementRatePct: 4.2, tickers: ['$TON'], externalDomains: ['fragment.com'], reactions: [] }]);
        const c3 = await connect({ token: 't', fetchImpl: tgCall.fetchImpl });
        const r3 = (await c3.callTool({
            name: 'get_telegram_channel_posts',
            arguments: { channels: ['durov'], minViews: 100000, excludeForwarded: true, maxPostsPerChannel: 5 },
        })) as Result;
        expect(tgCall.calls[0]!.body).toMatchObject({ minViews: 100000, excludeForwarded: true });
        expect(r3.structuredContent!.items[0]).toMatchObject({ tickers: ['$TON'], externalDomains: ['fragment.com'], engagementRatePct: 4.2 });
    });
});

describe('long runs', () => {
    it('returns partial items with finished=false, then get_run_results completes', async () => {
        const items = fixture('jobs');
        const slow = fakeApify(items.slice(0, 1), ['RUNNING']);
        const client = await connect({ token: 't', fetchImpl: slow.fetchImpl });
        const first = (await client.callTool({ name: 'search_ats_jobs', arguments: { companies: ['Stripe'] } })) as Result;
        expect(first.isError).toBeFalsy();
        expect(first.structuredContent!.finished).toBe(false);
        expect(text(first)).toContain('get_run_results');

        const done = fakeApify(items, ['SUCCEEDED']);
        const client2 = await connect({ token: 't', fetchImpl: done.fetchImpl });
        const second = (await client2.callTool({ name: 'get_run_results', arguments: { runId: 'run123' } })) as Result;
        expect(second.structuredContent!.finished).toBe(true);
        expect(second.structuredContent!.itemCount).toBe(3);
    });

    it('sends progress notifications while the run is going', async () => {
        const { fetchImpl } = fakeApify(fixture('jobs'), ['RUNNING', 'SUCCEEDED']);
        const client = await connect({ token: 't', fetchImpl });
        const progress: Array<{ progress: number; message?: string }> = [];
        const res = (await client.callTool(
            { name: 'search_ats_jobs', arguments: { companies: ['Stripe'] } },
            undefined,
            { onprogress: (p) => progress.push(p) },
        )) as Result;
        expect(res.structuredContent!.finished).toBe(true);
        expect(progress.length).toBeGreaterThan(0);
        expect(progress[0]!.message).toContain('run123');
    });

    it('returns items already pushed when a run times out', async () => {
        const { fetchImpl } = fakeApify(fixture('tg'), ['TIMED-OUT']);
        const client = await connect({ token: 't', fetchImpl });
        const res = (await client.callTool({ name: 'get_telegram_channel_posts', arguments: { channels: ['durov'] } })) as Result;
        expect(res.isError).toBeFalsy();
        expect(res.structuredContent!.itemCount).toBe(3);
        expect(text(res)).toContain('TIMED-OUT');
    });

    it('get_run_results reuses the cap of the original call', async () => {
        const slow = fakeApify([], ['RUNNING']);
        let lastUrl = '';
        const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
            lastUrl = String(input);
            return slow.fetchImpl(input, init);
        }) as typeof fetch;
        const client = await connect({ token: 't', fetchImpl });
        await client.callTool({ name: 'get_telegram_channel_posts', arguments: { channels: ['a', 'b'], maxPostsPerChannel: 150 } });
        await client.callTool({ name: 'get_run_results', arguments: { runId: 'run123' } });
        expect(lastUrl).toContain('limit=300');
    });

    it('reports failed runs with a link to the log', async () => {
        const { fetchImpl } = fakeApify([], ['FAILED']);
        const client = await connect({ token: 't', fetchImpl });
        const res = (await client.callTool({ name: 'verify_eu_company', arguments: { queries: ['X'] } })) as Result;
        expect(res.isError).toBe(true);
        expect(text(res)).toContain('ended with status FAILED');
        expect(text(res)).toContain('https://console.apify.com/view/runs/run123');
    });
});

describe('errors', () => {
    it('explains a missing token', async () => {
        const client = await connect({});
        const res = (await client.callTool({ name: 'verify_eu_company', arguments: { queries: ['FR22424761419'] } })) as Result;
        expect(res.isError).toBe(true);
        expect(text(res)).toContain('APIFY_TOKEN is not set');
    });

    it('explains 401 and 404 from Apify', async () => {
        const make = (status: number, message: string) =>
            (async () => new Response(JSON.stringify({ error: { type: 'x', message } }), { status })) as typeof fetch;
        const c401 = await connect({ token: 'bad', fetchImpl: make(401, 'User was not found or authentication token is not valid') });
        expect(text(await c401.callTool({ name: 'search_google_ads', arguments: { targets: ['stripe.com'] } }))).toContain('Check that APIFY_TOKEN');
        const c404 = await connect({ token: 't', fetchImpl: make(404, 'Actor was not found') });
        expect(text(await c404.callTool({ name: 'search_ats_jobs', arguments: {} }))).toContain('may not be public yet');
    });

    it('rejects a malformed date before calling Apify', async () => {
        const { calls, fetchImpl } = fakeApify([]);
        const client = await connect({ token: 't', fetchImpl });
        const res = (await client.callTool({ name: 'get_telegram_channel_posts', arguments: { channels: ['durov'], sinceDate: 'last week' } })) as Result;
        expect(res.isError).toBe(true);
        expect(calls).toHaveLength(0);
    });
});

describe('spend cap', () => {
    it('adds 20 % headroom and rounds up to a tenth of a cent', () => {
        expect(spendCap(0.002, 0.0015, 10)).toBe(0.021);
        expect(spendCap(0, 0.004, 3)).toBe(0.015);
        expect(spendCap(0.002, 0.0012, 1)).toBe(0.004);
    });
});
