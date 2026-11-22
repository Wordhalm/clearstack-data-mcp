import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ApifyError, runActor } from './apify.js';

export const VERSION = '0.1.0';

export const ACTORS = {
    jobs: 'clearstack-data/career-site-jobs-search',
    googleAds: 'clearstack-data/google-ads-transparency-scraper',
    telegram: 'clearstack-data/telegram-public-channel-monitor',
    kyb: 'clearstack-data/eu-company-kyb-enricher',
} as const;

export interface ServerOptions {
    token?: string;
    fetchImpl?: typeof fetch;
}

type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };

function pick(item: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const k of keys) if (item[k] !== undefined && item[k] !== null && item[k] !== '') out[k] = item[k];
    return out;
}

const JOB_FIELDS = ['company', 'ats', 'title', 'location', 'isRemote', 'department', 'team', 'employmentType', 'publishedAt', 'applyUrl'] as const;
const AD_FIELDS = ['target', 'advertiserName', 'advertiserId', 'creativeId', 'format', 'firstShownDate', 'lastShownDate', 'variationsCount', 'adUrl', 'previewImageUrl', 'regionFilter'] as const;
const KYB_FIELDS = ['query', 'found', 'kybStatus', 'country', 'legalName', 'registrationNumber', 'vatNumber', 'vatValid', 'leiCode', 'status', 'legalForm', 'activityCode', 'incorporationDate', 'employeeBand', 'address', 'registryUrls', 'error'] as const;

async function execute(
    actorId: string,
    input: Record<string, unknown>,
    maxItems: number,
    maxTotalChargeUsd: number,
    fields: readonly string[] | null,
    opts: ServerOptions,
    emptyHint: string,
): Promise<ToolResult> {
    try {
        const items = await runActor(actorId, input, { token: opts.token, maxItems, maxTotalChargeUsd, fetchImpl: opts.fetchImpl });
        const rows = fields ? items.map((i) => pick(i, fields)) : items;
        const header = rows.length
            ? `${rows.length} result(s) from https://apify.com/${actorId}`
            : `No results from https://apify.com/${actorId}. ${emptyHint}`;
        return { content: [{ type: 'text', text: `${header}\n${JSON.stringify(rows, null, 1)}` }] };
    } catch (err) {
        const msg = err instanceof ApifyError ? err.message : `Unexpected error: ${(err as Error).message}`;
        return { content: [{ type: 'text', text: msg }], isError: true };
    }
}

const readOnly = { readOnlyHint: true, openWorldHint: true, idempotentHint: true } as const;

export function createServer(opts: ServerOptions = {}): McpServer {
    const server = new McpServer({ name: 'clearstack-data', version: VERSION });

    server.registerTool(
        'search_ats_jobs',
        {
            title: 'Search company career sites',
            description:
                'List open roles straight from company career sites on Greenhouse, Lever, Ashby and SmartRecruiters ' +
                '(index of 25,787 employers). Use it for job search ("remote AI engineer roles at Anthropic, OpenAI, Linear") ' +
                'or hiring signals ("is Datadog hiring data engineers?"). Billed to your Apify account: $0.002 per run + $1.50 per 1,000 jobs.',
            inputSchema: {
                companies: z.array(z.string()).max(200).default([])
                    .describe('Company names ("Stripe"), ats:slug pairs ("greenhouse:stripe", "ashby:openai") or job board URLs. Empty = 35 well-known tech and AI employers.'),
                keywords: z.array(z.string()).default([]).describe('Match any of these in job title or department, e.g. ["AI Engineer", "Product Manager"]. Empty = all roles.'),
                location: z.string().default('').describe('Case-insensitive substring of the job location, e.g. "London", "Remote", "Germany".'),
                remoteOnly: z.boolean().default(false).describe('Only roles marked remote.'),
                maxJobs: z.number().int().min(1).max(500).default(50).describe('Maximum jobs to return.'),
            },
            annotations: readOnly,
        },
        async ({ companies, keywords, location, remoteOnly, maxJobs }) =>
            execute(
                ACTORS.jobs,
                { companies, keywords, location, remoteOnly, maxJobsTotal: maxJobs, discoveryPreset: 'TOP_TECH_AI', maxCompaniesToScan: 35 },
                maxJobs,
                0.002 + 0.0015 * maxJobs,
                JOB_FIELDS,
                opts,
                'Try fewer keywords, another spelling of the company, or the job board URL.',
            ),
    );

    server.registerTool(
        'search_google_ads',
        {
            title: 'Search Google Ads Transparency Center',
            description:
                'List the ads a company runs on Google (Search, Display, YouTube) from the public Google Ads Transparency Center: ' +
                'format, first and last shown dates, ad URL, preview image. Use it for competitor research. ' +
                'Billed to your Apify account: $0.002 per run + $1.20 per 1,000 ads.',
            inputSchema: {
                targets: z.array(z.string()).min(1).max(50)
                    .describe('Advertiser domains ("stripe.com"), Google advertiser IDs ("AR1695…") or Transparency Center URLs.'),
                region: z.string().default('ALL').describe('ISO-2 country code ("US", "GB", "FR") or "ALL".'),
                format: z.enum(['ALL', 'TEXT', 'IMAGE', 'VIDEO']).default('ALL'),
                dateRangeDays: z.number().int().min(0).max(400).default(30).describe('Only ads shown in the last N days; 0 = all history.'),
                maxAdsPerTarget: z.number().int().min(1).max(200).default(20),
            },
            annotations: readOnly,
        },
        async ({ targets, region, format, dateRangeDays, maxAdsPerTarget }) =>
            execute(
                ACTORS.googleAds,
                { targets, region, format, dateRangeDays, maxAdsPerTarget },
                Math.min(targets.length * maxAdsPerTarget, 2000),
                0.002 + 0.0012 * Math.min(targets.length * maxAdsPerTarget, 2000),
                AD_FIELDS,
                opts,
                'The advertiser may not run Google Ads under that domain, or not in that region and period.',
            ),
    );

    server.registerTool(
        'get_telegram_channel_posts',
        {
            title: 'Read public Telegram channels',
            description:
                'Fetch recent posts from public Telegram channels (no Telegram account needed): text, date, views, reactions, links. ' +
                'Optional keyword filter. Billed to your Apify account: $0.002 per run + $1.50 per 1,000 posts.',
            inputSchema: {
                channels: z.array(z.string()).min(1).max(50).describe('Channel usernames or URLs: "durov", "@telegram", "https://t.me/bloomberg".'),
                maxPostsPerChannel: z.number().int().min(1).max(500).default(30),
                sinceDate: z.string().default('').describe('Optional ISO date (YYYY-MM-DD); older posts are skipped.'),
                keywords: z.array(z.string()).default([]).describe('Only posts containing any of these words (case-insensitive).'),
            },
            annotations: readOnly,
        },
        async ({ channels, maxPostsPerChannel, sinceDate, keywords }) =>
            execute(
                ACTORS.telegram,
                { channels, maxMessagesPerChannel: maxPostsPerChannel, sinceDate, keywords, includeMediaUrls: false },
                Math.min(channels.length * maxPostsPerChannel, 2000),
                0.002 + 0.0015 * Math.min(channels.length * maxPostsPerChannel, 2000),
                null,
                opts,
                'Check that the channel is public (https://t.me/s/<name> must open in a browser).',
            ),
    );

    server.registerTool(
        'verify_eu_company',
        {
            title: 'Verify EU company and VAT number',
            description:
                'Validate EU VAT numbers against the European Commission VIES service and return the official registry record ' +
                '(France SIRENE, Swiss Zefix, Norway Brreg, Finland PRH, GLEIF LEI): legal name, status, address, legal form. ' +
                'Billed to your Apify account: $4.00 per 1,000 companies.',
            inputSchema: {
                queries: z.array(z.string()).min(1).max(500)
                    .describe('EU VAT numbers ("FR22424761419"), French SIREN/SIRET, Swiss UID ("CHE-105.909.036"), Norwegian org numbers ("NO:923609016").'),
                defaultCountry: z.string().default('').describe('ISO-2 country used when a query is a plain company name.'),
            },
            annotations: readOnly,
        },
        async ({ queries, defaultCountry }) =>
            execute(
                ACTORS.kyb,
                { queries, defaultCountry, validateVat: true, enrichGleifLei: true },
                queries.length,
                0.004 * queries.length,
                KYB_FIELDS,
                opts,
                'Check the identifier format.',
            ),
    );

    return server;
}
