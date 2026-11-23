import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ApifyError, getRunResults, runActor, spendCap, type ClientOptions, type RunResult } from './apify.js';

export const VERSION = '0.2.1';

type Item = Record<string, unknown>;
type Shape = (item: Item) => Item;

interface ActorSpec {
    id: string;
    startUsd: number;
    perItemUsd: number;
    shape: Shape;
    emptyHint: string;
}

/** Copies only the listed fields that have a value. */
function keep(keys: readonly string[]): Shape {
    return (item) => {
        const out: Item = {};
        for (const k of keys) {
            const v = item[k];
            if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) continue;
            out[k] = v;
        }
        return out;
    };
}

const telegramShape: Shape = (item) => {
    const base = keep([
        'channel', 'channelTitle', 'channelSubscribersNum', 'messageId', 'postUrl', 'publishedAt', 'text',
        'viewsNum', 'hasPhoto', 'hasVideo', 'hasDocument', 'links', 'hashtags', 'forwardedFrom', 'replyToMessageId',
    ])(item);
    // Paid Telegram Stars count stars spent, not reactions, so they are reported apart.
    const reactions = Array.isArray(item.reactions) ? (item.reactions as Array<{ countNum?: unknown; type?: unknown }>) : [];
    let total = 0;
    let stars = 0;
    for (const r of reactions) {
        const n = typeof r.countNum === 'number' ? r.countNum : 0;
        if (r.type === 'paid_stars') stars += n;
        else total += n;
    }
    if (total > 0) base.reactionsTotal = total;
    if (stars > 0) base.paidStars = stars;
    return base;
};

export const ACTORS = {
    jobs: {
        id: 'clearstack-data/career-site-jobs-search',
        startUsd: 0.002,
        perItemUsd: 0.0015,
        shape: keep(['company', 'ats', 'title', 'location', 'isRemote', 'department', 'team', 'employmentType', 'publishedAt', 'applyUrl']),
        emptyHint: 'Try fewer keywords, another spelling of the company, or its job board URL.',
    },
    googleAds: {
        id: 'clearstack-data/google-ads-transparency-scraper',
        startUsd: 0.002,
        perItemUsd: 0.0012,
        shape: keep(['target', 'advertiserName', 'advertiserId', 'domain', 'creativeId', 'format', 'firstShownDate', 'lastShownDate', 'variationsCount', 'adUrl', 'previewImageUrl', 'regionFilter']),
        emptyHint: 'The advertiser may not run Google Ads under that domain, or not in that region and period.',
    },
    telegram: {
        id: 'clearstack-data/telegram-public-channel-monitor',
        startUsd: 0.002,
        perItemUsd: 0.0015,
        shape: telegramShape,
        emptyHint: 'Check that the channel is public: https://t.me/s/<name> must open in a browser.',
    },
    kyb: {
        id: 'clearstack-data/eu-company-kyb-enricher',
        startUsd: 0,
        perItemUsd: 0.004,
        shape: keep(['query', 'found', 'kybStatus', 'country', 'legalName', 'registrationNumber', 'vatNumber', 'vatValid', 'leiCode', 'status', 'legalForm', 'activityCode', 'incorporationDate', 'employeeBand', 'latestRevenueEur', 'latestNetIncomeEur', 'latestFinancialYear', 'address', 'officers', 'registryUrls', 'error']),
        emptyHint: 'Check the identifier format.',
    },
} satisfies Record<string, ActorSpec>;

const INSTRUCTIONS = `Tools for B2B research backed by ClearStack Data Actors on Apify. Every call runs on the user's own Apify account and costs a few cents at most; the price is in each tool description.
- Hiring questions (who is hiring, open roles at a company, remote jobs at specific employers): search_ats_jobs.
- What a company advertises on Google, ad formats, since when: search_google_ads.
- Recent posts of public Telegram channels: get_telegram_channel_posts.
- Is an EU VAT number valid, official company record (FR, CH, NO, FI, LEI): verify_eu_company.
If a result has finished=false, the Apify run is still going: call get_run_results with its runId instead of starting a new run.`;

export const outputSchema = {
    actor: z.string().describe('Apify Actor that produced the data'),
    runId: z.string().describe('Apify run ID; pass it to get_run_results if finished is false'),
    status: z.string().describe('Apify run status, e.g. SUCCEEDED or RUNNING'),
    finished: z.boolean().describe('false when the run was still going and items are partial'),
    itemCount: z.number().int(),
    items: z.array(z.record(z.unknown())),
};

type Structured = { actor: string; runId: string; status: string; finished: boolean; itemCount: number; items: Item[] };
type ToolResult = { content: Array<{ type: 'text'; text: string }>; structuredContent?: Structured; isError?: boolean };

export interface ServerOptions {
    token?: string;
    fetchImpl?: typeof fetch;
    /** Seconds per poll and total wait; overridden in tests. */
    pollSecs?: number;
    maxWaitSecs?: number;
}

interface Extra {
    _meta?: { progressToken?: string | number };
    sendNotification: (n: { method: 'notifications/progress'; params: { progressToken: string | number; progress: number; message?: string } }) => Promise<void>;
}

function clientOptions(opts: ServerOptions, extra?: Extra): ClientOptions {
    const token = extra?._meta?.progressToken;
    return {
        token: opts.token,
        fetchImpl: opts.fetchImpl,
        pollSecs: opts.pollSecs,
        maxWaitSecs: opts.maxWaitSecs,
        onProgress: token === undefined || !extra
            ? undefined
            : (elapsed, message) => extra.sendNotification({ method: 'notifications/progress', params: { progressToken: token, progress: elapsed, message } }),
    };
}

function render(spec: ActorSpec | null, actorLabel: string, result: RunResult): ToolResult {
    const items = spec ? result.items.map(spec.shape) : result.items;
    const structured: Structured = {
        actor: actorLabel,
        runId: result.runId,
        status: result.status,
        finished: result.finished,
        itemCount: items.length,
        items,
    };
    let header: string;
    if (result.status !== 'SUCCEEDED' && result.finished) {
        header = `The Apify run ${result.runId} ended with status ${result.status} after returning ${items.length} item(s); they are below. Log: https://console.apify.com/view/runs/${result.runId}`;
    } else if (!result.finished) {
        header = `Run ${result.runId} is still ${result.status.toLowerCase()}; ${items.length} item(s) so far. Call get_run_results with runId "${result.runId}" for the rest.`;
    } else if (items.length === 0) {
        header = `No results from https://apify.com/${actorLabel}. ${spec?.emptyHint ?? ''}`.trim();
    } else {
        header = `${items.length} result(s) from https://apify.com/${actorLabel} (run ${result.runId}).`;
    }
    return { content: [{ type: 'text', text: `${header}\n${JSON.stringify(items)}` }], structuredContent: structured };
}

function failure(err: unknown): ToolResult {
    const msg = err instanceof ApifyError ? err.message : `Unexpected error: ${(err as Error).message}`;
    return { content: [{ type: 'text', text: msg }], isError: true };
}

const readOnly = { readOnlyHint: true, destructiveHint: false, openWorldHint: true } as const;

export function createServer(opts: ServerOptions = {}): McpServer {
    const server = new McpServer({ name: 'clearstack-data', version: VERSION }, { instructions: INSTRUCTIONS });
    /** Remembers which tool started a run and its item cap, so get_run_results can return the same shape and size. */
    const runSpecs = new Map<string, { spec: ActorSpec; maxItems: number }>();

    async function execute(spec: ActorSpec, input: Item, items: number, extra?: Extra): Promise<ToolResult> {
        try {
            const result = await runActor(
                spec.id,
                input,
                { maxItems: items, maxTotalChargeUsd: spendCap(spec.startUsd, spec.perItemUsd, items) },
                clientOptions(opts, extra),
            );
            runSpecs.set(result.runId, { spec, maxItems: items });
            return render(spec, spec.id, result);
        } catch (err) {
            return failure(err);
        }
    }

    server.registerTool(
        'search_ats_jobs',
        {
            title: 'Search company career sites',
            description:
                'List open roles straight from company career sites on Greenhouse, Lever, Ashby and SmartRecruiters ' +
                '(index of 25,787 employers). Use it for job search ("remote AI engineer roles at Anthropic, OpenAI, Linear") ' +
                'or hiring signals ("is Datadog hiring data engineers?"). Returns title, location, team, publish date and apply URL. ' +
                'Cost on the user\'s Apify account: $0.002 per call + $0.0015 per job returned.',
            inputSchema: {
                companies: z.array(z.string()).max(200).default([])
                    .describe('Company names ("Stripe"), ats:slug pairs ("greenhouse:stripe", "ashby:openai") or job board URLs. Empty = 35 well-known tech and AI employers.'),
                keywords: z.array(z.string()).default([]).describe('Match any of these in the job title or department, e.g. ["AI Engineer", "Product Manager"]. Empty = all roles.'),
                location: z.string().default('').describe('Case-insensitive substring of the job location, e.g. "London", "Remote", "Germany".'),
                remoteOnly: z.boolean().default(false).describe('Only roles marked remote.'),
                maxJobs: z.number().int().min(1).max(500).default(50).describe('Maximum jobs to return (and pay for).'),
            },
            outputSchema,
            annotations: { ...readOnly, title: 'Search company career sites' },
        },
        async ({ companies, keywords, location, remoteOnly, maxJobs }, extra) =>
            execute(
                ACTORS.jobs,
                { companies, keywords, location, remoteOnly, maxJobsTotal: maxJobs, discoveryPreset: 'TOP_TECH_AI', maxCompaniesToScan: 35 },
                maxJobs,
                extra as Extra,
            ),
    );

    server.registerTool(
        'search_google_ads',
        {
            title: 'Search Google Ads Transparency Center',
            description:
                'List the ads a company runs on Google (Search, Display, YouTube) from the public Google Ads Transparency Center: ' +
                'advertiser, format, first and last shown dates, ad URL and preview image. Use it for competitor research. ' +
                'Cost on the user\'s Apify account: $0.002 per call + $0.0012 per ad returned.',
            inputSchema: {
                targets: z.array(z.string()).min(1).max(10)
                    .describe('Advertiser domains ("stripe.com"), Google advertiser IDs ("AR1695…") or Transparency Center URLs.'),
                region: z.string().default('ALL').describe('ISO-2 country code ("US", "GB", "FR") or "ALL".'),
                format: z.enum(['ALL', 'TEXT', 'IMAGE', 'VIDEO']).default('ALL'),
                dateRangeDays: z.number().int().min(0).max(400).default(30).describe('Only ads shown in the last N days; 0 = all history.'),
                maxAdsPerTarget: z.number().int().min(1).max(100).default(20),
            },
            outputSchema,
            annotations: { ...readOnly, title: 'Search Google Ads Transparency Center' },
        },
        async ({ targets, region, format, dateRangeDays, maxAdsPerTarget }, extra) =>
            execute(ACTORS.googleAds, { targets, region, format, dateRangeDays, maxAdsPerTarget }, targets.length * maxAdsPerTarget, extra as Extra),
    );

    server.registerTool(
        'get_telegram_channel_posts',
        {
            title: 'Read public Telegram channels',
            description:
                'Fetch recent posts from public Telegram channels without a Telegram account: text, date, views, reactions, links, hashtags. ' +
                'Optional keyword filter and date cutoff. Cost on the user\'s Apify account: $0.002 per call + $0.0015 per post returned.',
            inputSchema: {
                channels: z.array(z.string()).min(1).max(10).describe('Channel usernames or URLs: "durov", "@telegram", "https://t.me/bloomberg".'),
                maxPostsPerChannel: z.number().int().min(1).max(200).default(30).describe('Newest posts first.'),
                sinceDate: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Use YYYY-MM-DD').default('').describe('Optional date (YYYY-MM-DD); older posts are skipped.'),
                keywords: z.array(z.string()).default([]).describe('Only posts containing any of these words (case-insensitive).'),
            },
            outputSchema,
            annotations: { ...readOnly, title: 'Read public Telegram channels' },
        },
        async ({ channels, maxPostsPerChannel, sinceDate, keywords }, extra) =>
            execute(
                ACTORS.telegram,
                { channels, maxMessagesPerChannel: maxPostsPerChannel, sinceDate, keywords, includeMediaUrls: false },
                channels.length * maxPostsPerChannel,
                extra as Extra,
            ),
    );

    server.registerTool(
        'verify_eu_company',
        {
            title: 'Verify EU company and VAT number',
            description:
                'Validate EU VAT numbers against the European Commission VIES service and return the official registry record ' +
                '(France SIRENE, Swiss Zefix, Norway Brreg, Finland PRH, GLEIF LEI): legal name, status, address, legal form, officers. ' +
                'Cost on the user\'s Apify account: $0.004 per company.',
            inputSchema: {
                queries: z.array(z.string()).min(1).max(200)
                    .describe('EU VAT numbers ("FR22424761419"), French SIREN/SIRET, Swiss UID ("CHE-105.909.036"), Norwegian org numbers ("NO:923609016").'),
                defaultCountry: z.string().default('').describe('ISO-2 country used when a query is a plain company name.'),
            },
            outputSchema,
            annotations: { ...readOnly, title: 'Verify EU company and VAT number' },
        },
        async ({ queries, defaultCountry }, extra) =>
            execute(ACTORS.kyb, { queries, defaultCountry, validateVat: true, enrichGleifLei: true }, queries.length, extra as Extra),
    );

    server.registerTool(
        'get_run_results',
        {
            title: 'Get results of a running search',
            description:
                'When another tool returned finished=false, wait for that Apify run and return its items. No extra cost: the run is already paid for.',
            inputSchema: {
                runId: z.string().min(5).describe('runId returned by a previous tool call.'),
                maxItems: z.number().int().min(1).max(2000).optional().describe('Defaults to the cap of the original call.'),
            },
            outputSchema,
            annotations: { ...readOnly, idempotentHint: true, title: 'Get results of a running search' },
        },
        async ({ runId, maxItems }, extra) => {
            try {
                const known = runSpecs.get(runId);
                const result = await getRunResults(runId, maxItems ?? known?.maxItems ?? 2000, clientOptions(opts, extra as Extra));
                const spec = known?.spec ?? null;
                return render(spec, spec?.id ?? result.actId, result);
            } catch (err) {
                return failure(err);
            }
        },
    );

    return server;
}
