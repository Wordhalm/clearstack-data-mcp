import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ApifyError, getRunResults, runActor, spendCap, type ClientOptions, type RunResult } from './apify.js';

export const VERSION = '0.3.0';

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
        'viewsNum', 'engagementRatePct', 'hasPhoto', 'hasVideo', 'hasDocument',
        'links', 'externalDomains', 'hashtags', 'mentions', 'tickers', 'cryptoAddresses',
        'forwardedFrom', 'replyToMessageId',
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
        shape: keep([
            'company', 'ats', 'title', 'location', 'workplaceType', 'isRemote', 'seniority',
            'department', 'team', 'employmentType',
            'salaryMin', 'salaryMax', 'salaryCurrency', 'salaryInterval',
            'salaryAnnualUsdMin', 'salaryAnnualUsdMax', 'salaryRaw', 'hasEquity',
            'techStack', 'descriptionSnippet', 'publishedAt', 'applyUrl',
        ]),
        emptyHint: 'Try fewer keywords/filters, another spelling of the company, or its job board URL.',
    },
    googleAds: {
        id: 'clearstack-data/google-ads-transparency-scraper',
        startUsd: 0.002,
        perItemUsd: 0.0012,
        shape: keep([
            'target', 'advertiserName', 'advertiserId', 'domain', 'creativeId', 'format',
            'firstShownDate', 'lastShownDate', 'activeDays', 'variationsCount',
            'adUrl', 'previewImageUrl', 'regionFilter',
            'countriesShown', 'euImpressionsMin', 'euImpressionsMax',
            'euTargetingIncluded', 'euTargetingExcluded',
        ]),
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
        shape: keep([
            'query', 'found', 'kybStatus', 'kybRiskFlags', 'country', 'legalName',
            'registrationNumber', 'vatNumber', 'vatValid', 'leiCode', 'status', 'legalForm',
            'activityCode', 'incorporationDate', 'employeeBand',
            'latestRevenueEur', 'latestNetIncomeEur', 'latestFinancialYear',
            'address', 'officers', 'sanctions', 'registryUrls', 'error',
        ]),
        emptyHint: 'Check the identifier format.',
    },
    tenders: {
        id: 'clearstack-data/eu-public-tenders-monitor',
        startUsd: 0,
        perItemUsd: 0.002,
        shape: keep([
            'source', 'noticeId', 'country', 'title', 'buyerName', 'buyerRegion',
            'publicationDate', 'deadlineDate', 'daysUntilDeadline',
            'estimatedValue', 'currency', 'estimatedValueEur',
            'awardedValue', 'awardedCurrency', 'winners',
            'cpvCodes', 'noticeCategory', 'contractNature', 'status', 'url', 'pdfUrl',
        ]),
        emptyHint: 'Try widening publishedSinceDays, removing minValueEur, or broadening keywords/countries.',
    },
} satisfies Record<string, ActorSpec>;

const INSTRUCTIONS = `Tools for live B2B & OSINT research backed by ClearStack Data Actors on Apify. Every call runs on the user's own Apify account with an automatic spending cap; the price is in each tool description.
- Hiring questions (open roles, salaries, tech stack, seniority, remote jobs across 25,787 employers): search_ats_jobs.
- Competitor Google Ads (formats, active longevity, optional EU DSA impressions & targeting): search_google_ads.
- Public Telegram channels (recent posts, engagement, tickers, crypto addresses, external domains): get_telegram_channel_posts.
- EU company KYB, VIES VAT validation, official registries (FR, CH, NO, FI, LEI) & live OFAC/EU/UN sanctions screening: verify_eu_company.
- European public procurement tenders & contract awards (EU TED, France BOAMP, UK Find a Tender): search_eu_tenders.
If a result has finished=false, the Apify run is still going: call get_run_results with its runId instead of starting a new run.`;

export const outputSchema = {
    actor: z.string().describe('Apify Actor that produced the data'),
    runId: z.string().describe('Apify run ID; pass it to get_run_results if finished is false'),
    status: z.string().describe('Apify run status, e.g. SUCCEEDED or RUNNING'),
    finished: z.boolean().describe('false when the run was still going and items are partial'),
    itemCount: z.number().int(),
    items: z.array(z.record(z.string(), z.unknown())),
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
                'Search live open roles straight from company career sites on Greenhouse, Lever, Ashby and SmartRecruiters (25,787 employers indexed), ' +
                'with structured multi-currency salaries (plus indicative annual USD equivalents), 65+ detected tech stack skills, seniority, and remote/hybrid/onsite classification. ' +
                'Use for direct job search or B2B hiring signals; do not use for LinkedIn/Indeed listings or companies outside those four ATS platforms. ' +
                'Pass `companies` (empty scans 35 top tech/AI employers) with optional `keywords`, `requiredSkills` (aliases like "k8s" or "golang" supported), `seniorityLevels`, `minSalaryUsd`, `location`, and `remoteOnly`. ' +
                'Waits up to 45s (returns finished=false + runId for get_run_results on large scans). ' +
                'Billed to the user\'s Apify account: $0.002/call + $0.0015/job, capped by `maxJobs`.',
            inputSchema: {
                companies: z.array(z.string()).max(200).default([])
                    .describe('Company names ("Stripe"), ats:slug pairs ("greenhouse:stripe", "ashby:openai") or job board URLs. Empty = 35 well-known tech and AI employers.'),
                keywords: z.array(z.string()).default([]).describe('Match any of these in the job title, department, or tech stack, e.g. ["AI Engineer", "Product Manager"]. Empty = all roles.'),
                requiredSkills: z.array(z.string()).default([]).describe('Require ALL listed skills (AND logic; aliases like "k8s", "golang", "postgres" map to canonical skills), e.g. ["Python", "Kubernetes"].'),
                seniorityLevels: z.array(z.enum(['intern', 'entry', 'mid', 'senior', 'staff', 'lead', 'manager', 'director', 'executive'])).default([])
                    .describe('Filter by classified seniority levels, e.g. ["senior", "staff"]. Empty = all levels.'),
                minSalaryUsd: z.number().int().min(0).optional()
                    .describe('Optional minimum annual salary in approximate USD equivalent (converts USD, EUR, GBP, CHF, CAD, AUD). Excludes jobs without disclosed salary.'),
                location: z.string().default('').describe('Case-insensitive substring of the job location, e.g. "London", "Remote", "Germany".'),
                remoteOnly: z.boolean().default(false).describe('Only roles marked remote.'),
                maxJobs: z.number().int().min(1).max(500).default(50).describe('Maximum jobs to return (and pay for).'),
            },
            outputSchema,
            annotations: { ...readOnly, title: 'Search company career sites' },
        },
        async ({ companies, keywords, requiredSkills, seniorityLevels, minSalaryUsd, location, remoteOnly, maxJobs }, extra) =>
            execute(
                ACTORS.jobs,
                {
                    companies,
                    keywords,
                    requiredSkills,
                    seniorityLevels,
                    ...(minSalaryUsd !== undefined ? { minSalaryUsd } : {}),
                    location,
                    remoteOnly,
                    includeDescriptions: true,
                    maxJobsTotal: maxJobs,
                    discoveryPreset: 'TOP_TECH_AI',
                    maxCompaniesToScan: 35,
                },
                maxJobs,
                extra as Extra,
            ),
    );

    server.registerTool(
        'search_google_ads',
        {
            title: 'Search Google Ads Transparency Center',
            description:
                'Fetch live and recent Google Ads (Search, Display, YouTube) from the public Google Ads Transparency Center, ' +
                'including active duration (`activeDays`) and optional EU Digital Services Act (DSA) impression ranges and targeting criteria (`includeDetails: true`). ' +
                'Use for competitor ad monitoring; do not use for Meta/LinkedIn/TikTok ads or exact dollar ad spend. ' +
                'Pass 1-10 `targets` (domains, advertiser IDs, or URLs) with optional `region`, `format`, `dateRangeDays` (0 = all history), `minActiveDays`, and `includeDetails`. ' +
                'Truncates at `targets.length * maxAdsPerTarget` and waits up to 45s (returns finished=false + runId for get_run_results). ' +
                'Billed to the user\'s Apify account: $0.002/call + $0.0012/ad, capped by total target-ad limit.',
            inputSchema: {
                targets: z.array(z.string()).min(1).max(10)
                    .describe('Advertiser domains ("stripe.com"), Google advertiser IDs ("AR1695…") or Transparency Center URLs.'),
                region: z.string().default('ALL').describe('ISO-2 country code ("US", "GB", "FR") or "ALL".'),
                format: z.enum(['ALL', 'TEXT', 'IMAGE', 'VIDEO']).default('ALL').describe('Ad creative format filter: "ALL", "TEXT", "IMAGE", or "VIDEO".'),
                dateRangeDays: z.number().int().min(0).max(400).default(30).describe('Only ads shown in the last N days; 0 = all history.'),
                minActiveDays: z.number().int().min(1).optional().describe('Optional minimum active duration in days (e.g. 30 to find evergreen winning ads).'),
                includeDetails: z.boolean().default(false).describe('Fetch per-ad EU DSA impression ranges (euImpressionsMin/Max), countriesShown, and targeting criteria (slower).'),
                maxAdsPerTarget: z.number().int().min(1).max(100).default(20).describe('Maximum ads returned per target (1-100); total billed items cap at targets.length * maxAdsPerTarget.'),
            },
            outputSchema,
            annotations: { ...readOnly, title: 'Search Google Ads Transparency Center' },
        },
        async ({ targets, region, format, dateRangeDays, minActiveDays, includeDetails, maxAdsPerTarget }, extra) =>
            execute(
                ACTORS.googleAds,
                {
                    targets,
                    region,
                    format,
                    dateRangeDays,
                    ...(minActiveDays !== undefined ? { minActiveDays } : {}),
                    includeDetails,
                    maxAdsPerTarget,
                },
                targets.length * maxAdsPerTarget,
                extra as Extra,
            ),
    );

    server.registerTool(
        'get_telegram_channel_posts',
        {
            title: 'Read public Telegram channels',
            description:
                'Fetch recent posts from public Telegram channels via web preview without any Telegram account or bot token, ' +
                'automatically extracting OSINT/finance entities (`externalDomains`, uppercase `tickers` like $BTC/$NVDA, `cryptoAddresses` EVM/BTC/SOL, `hashtags`, `mentions`) and engagement metrics (`reactionsTotal`, `paidStars`, `engagementRatePct`). ' +
                'Use to monitor public channels (`t.me/s/<name>`); do not use for private channels/groups, direct messages, or global Telegram search. ' +
                'Pass 1-10 `channels` with optional `sinceDate`, `keywords`, `minViews`, and `excludeForwarded`; paginates newest-first up to `maxPostsPerChannel`. ' +
                'Waits up to 45s (returns finished=false + runId for get_run_results). ' +
                'Billed to the user\'s Apify account: $0.002/call + $0.0015/post, capped by `channels.length * maxPostsPerChannel`.',
            inputSchema: {
                channels: z.array(z.string()).min(1).max(10).describe('Channel usernames or URLs: "durov", "@telegram", "https://t.me/bloomberg".'),
                maxPostsPerChannel: z.number().int().min(1).max(200).default(30).describe('Newest posts first.'),
                sinceDate: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Use YYYY-MM-DD').default('').describe('Optional date (YYYY-MM-DD); older posts are skipped.'),
                keywords: z.array(z.string()).default([]).describe('Only posts containing any of these words, hashtags, or cashtags (case-insensitive).'),
                minViews: z.number().int().min(0).optional().describe('Optional minimum view count filter.'),
                excludeForwarded: z.boolean().default(false).describe('Skip forwarded/reposted messages and return only original posts.'),
            },
            outputSchema,
            annotations: { ...readOnly, title: 'Read public Telegram channels' },
        },
        async ({ channels, maxPostsPerChannel, sinceDate, keywords, minViews, excludeForwarded }, extra) =>
            execute(
                ACTORS.telegram,
                {
                    channels,
                    maxMessagesPerChannel: maxPostsPerChannel,
                    sinceDate,
                    keywords,
                    ...(minViews !== undefined ? { minViews } : {}),
                    excludeForwarded,
                    includeMediaUrls: false,
                },
                channels.length * maxPostsPerChannel,
                extra as Extra,
            ),
    );

    server.registerTool(
        'verify_eu_company',
        {
            title: 'Verify EU company, VAT & sanctions',
            description:
                'Validate EU-27 VAT numbers against the European Commission VIES service, enrich official company records (France SIRENE, Switzerland Zefix, Norway Brreg, Finland PRH, GLEIF LEI), ' +
                'and screen both companies and extracted officers live against US OFAC SDN/ALT, EU Financial Sanctions (FSF), and UN Security Council lists with factual `kybRiskFlags`. ' +
                'Use for EU B2B KYB, vendor onboarding, VAT checks, or sanctions screening; do not use for non-EU company registries unless they hold a 20-character LEI or only need sanctions screening. ' +
                'Batches 1-200 `queries` (set `defaultCountry` for plain company names; `screenSanctions` defaults to true). `vatValid: null` signals a temporary VIES outage (retry later, not invalid). ' +
                'Waits up to 45s (finished=false -> get_run_results). Billed to the user\'s Apify account: $0.004 per company queried.',
            inputSchema: {
                queries: z.array(z.string()).min(1).max(200)
                    .describe('EU VAT numbers ("FR22424761419"), French SIREN/SIRET, Swiss UID ("CHE-105.909.036"), Norwegian org numbers ("NO:923609016"), LEI codes, or company names.'),
                defaultCountry: z.string().default('').describe('ISO-2 country used when a query is a plain company name.'),
                screenSanctions: z.boolean().default(true).describe('Screen resolved companies and officers live against US OFAC SDN/ALT, EU FSF, and UN Security Council sanctions lists.'),
            },
            outputSchema,
            annotations: { ...readOnly, title: 'Verify EU company, VAT & sanctions' },
        },
        async ({ queries, defaultCountry, screenSanctions }, extra) =>
            execute(
                ACTORS.kyb,
                { queries, defaultCountry, validateVat: true, enrichGleifLei: true, screenSanctions },
                queries.length,
                extra as Extra,
            ),
    );

    server.registerTool(
        'search_eu_tenders',
        {
            title: 'Search EU, France & UK public tenders',
            description:
                'Search live European public procurement notices and contract awards across three official government APIs: EU TED (27 EU + EEA), France BOAMP, and UK Find a Tender (OCDS). ' +
                'Use for B2B government bid discovery (`noticeCategory: "OPEN_TENDER"`) or competitive award intelligence (`noticeCategory: "CONTRACT_AWARD"`, returning winning suppliers and awarded contract values); do not use for US SAM.gov or private RFPs. ' +
                'Combine `sources`, `keywords`, ISO-2 `countries`, 8-digit `cpvCodes`, `noticeCategory`, `minValueEur`, `publishedSinceDays`, and `onlyOpenTenders`. ' +
                'Waits up to 45s (returns finished=false + runId for get_run_results). ' +
                'Billed to the user\'s Apify account: $0.002/tender returned, capped by `sources.length * maxResultsPerSource`.',
            inputSchema: {
                sources: z.array(z.enum(['EU_TED', 'FR_BOAMP', 'UK_FTS'])).min(1).default(['EU_TED', 'FR_BOAMP', 'UK_FTS'])
                    .describe('Official government portals to query: "EU_TED", "FR_BOAMP", and/or "UK_FTS".'),
                keywords: z.array(z.string()).default([]).describe('Optional OR-logic keywords, e.g. ["cloud", "cybersecurity"]. Empty = latest matching notices.'),
                countries: z.array(z.string()).default([]).describe('Optional ISO-2 country codes, e.g. ["FR", "DE", "GB"].'),
                cpvCodes: z.array(z.string()).default([]).describe('Optional 8-digit CPV procurement codes, e.g. ["72000000", "48000000"].'),
                noticeCategory: z.enum(['ALL', 'OPEN_TENDER', 'CONTRACT_AWARD', 'PLANNING']).default('ALL')
                    .describe('Filter by stage: "ALL", "OPEN_TENDER" (active bids), "CONTRACT_AWARD" (winners & awarded values), or "PLANNING".'),
                minValueEur: z.number().int().min(0).optional()
                    .describe('Optional minimum estimated/awarded contract budget in approximate EUR equivalent (converts GBP, CHF, PLN, SEK, NOK, DKK, CZK, USD).'),
                publishedSinceDays: z.number().int().min(1).max(365).default(14).describe('Only notices published in the last N days (1-365).'),
                onlyOpenTenders: z.boolean().default(false).describe('Exclude tenders whose submission deadline has already passed.'),
                maxResultsPerSource: z.number().int().min(1).max(100).default(15).describe('Maximum notices returned per selected source (1-100).'),
            },
            outputSchema,
            annotations: { ...readOnly, title: 'Search EU, France & UK public tenders' },
        },
        async ({ sources, keywords, countries, cpvCodes, noticeCategory, minValueEur, publishedSinceDays, onlyOpenTenders, maxResultsPerSource }, extra) =>
            execute(
                ACTORS.tenders,
                {
                    sources,
                    keywords,
                    countries,
                    cpvCodes,
                    noticeCategory,
                    ...(minValueEur !== undefined ? { minValueEur } : {}),
                    publishedSinceDays,
                    onlyOpenTenders,
                    maxResultsPerSource,
                },
                sources.length * maxResultsPerSource,
                extra as Extra,
            ),
    );

    server.registerTool(
        'get_run_results',
        {
            title: 'Get results of a running search',
            description:
                'Poll and collect remaining items from an in-progress Apify run after a sibling search tool returned `finished: false`. ' +
                'Use only with a `runId` from `search_ats_jobs`, `search_google_ads`, `get_telegram_channel_posts`, `verify_eu_company`, or `search_eu_tenders`; never use to start a new search. ' +
                'Optionally override `maxItems` (1-2000; defaults to the original call\'s cap). Polls automatically for up to 45s at no extra Apify cost; ' +
                'if still RUNNING, call again with the same `runId`. Failed, timed-out, or aborted runs return any partial items collected plus the Apify Console log URL.',
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
