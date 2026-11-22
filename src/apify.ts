export const APIFY_API = 'https://api.apify.com/v2';

/** MCP clients commonly give up on a request after 60 s, so one tool call never waits longer than this. */
export const MAX_WAIT_SECS = 45;
/** Hard limit for the Actor run itself; a run still going after a tool call returns keeps running up to this. */
export const RUN_TIMEOUT_SECS = 300;

const TERMINAL_OK = new Set(['SUCCEEDED']);
const TERMINAL_FAIL = new Set(['FAILED', 'ABORTED', 'TIMED-OUT', 'TIMING-OUT', 'ABORTING']);

export class ApifyError extends Error {
    constructor(message: string, readonly status?: number) {
        super(message);
        this.name = 'ApifyError';
    }
}

export interface ApifyRun {
    id: string;
    actId: string;
    status: string;
    statusMessage?: string | null;
    defaultDatasetId: string;
}

export interface RunResult {
    runId: string;
    status: string;
    finished: boolean;
    items: Record<string, unknown>[];
}

export interface ClientOptions {
    token: string | undefined;
    fetchImpl?: typeof fetch;
    /** Called while waiting for a run, so the server can send MCP progress notifications. */
    onProgress?: (elapsedSecs: number, message: string) => Promise<void> | void;
    /** Seconds per waitForFinish poll; smaller in tests. */
    pollSecs?: number;
    maxWaitSecs?: number;
}

export interface StartOptions {
    maxItems: number;
    maxTotalChargeUsd: number;
}

function missingToken(): ApifyError {
    return new ApifyError(
        'APIFY_TOKEN is not set. Add your Apify API token to this MCP server\'s configuration ' +
            '(get one at https://console.apify.com/settings/integrations).',
    );
}

async function call<T>(path: string, init: RequestInit, opts: ClientOptions): Promise<T> {
    if (!opts.token) throw missingToken();
    const fetchImpl = opts.fetchImpl ?? fetch;
    let res: Response;
    try {
        res = await fetchImpl(`${APIFY_API}${path}`, {
            ...init,
            headers: { Authorization: `Bearer ${opts.token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
        });
    } catch (err) {
        throw new ApifyError(`Could not reach the Apify API: ${(err as Error).message}`);
    }
    const text = await res.text();
    if (!res.ok) throw new ApifyError(describeHttpError(res.status, text, path), res.status);
    try {
        return JSON.parse(text) as T;
    } catch {
        throw new ApifyError(`Unexpected response from the Apify API (HTTP ${res.status}).`);
    }
}

function describeHttpError(status: number, body: string, path: string): string {
    let message = body.slice(0, 300);
    let type = '';
    try {
        const parsed = JSON.parse(body) as { error?: { message?: string; type?: string } };
        if (parsed.error?.message) message = parsed.error.message;
        if (parsed.error?.type) type = parsed.error.type;
    } catch {
        /* keep raw text */
    }
    const base = `Apify returned HTTP ${status}: ${message}`;
    if (status === 401) return `${base}. Check that APIFY_TOKEN is a valid Apify API token.`;
    if (status === 402 || type.includes('usage') || type.includes('limit')) {
        return `${base}. Your Apify account has hit a usage or spending limit; see https://console.apify.com/billing.`;
    }
    if (status === 404 && path.startsWith('/acts/')) {
        return `${base}. The Actor could not be found; it may not be public yet.`;
    }
    return base;
}

function isTerminal(status: string): boolean {
    return TERMINAL_OK.has(status) || TERMINAL_FAIL.has(status);
}

async function waitForRun(run: ApifyRun, opts: ClientOptions): Promise<ApifyRun> {
    const pollSecs = opts.pollSecs ?? 15;
    const maxWait = opts.maxWaitSecs ?? MAX_WAIT_SECS;
    let current = run;
    let elapsed = 0;
    while (!isTerminal(current.status) && elapsed < maxWait) {
        const wait = Math.min(pollSecs, maxWait - elapsed);
        const res = await call<{ data: ApifyRun }>(`/actor-runs/${current.id}?waitForFinish=${wait}`, { method: 'GET' }, opts);
        current = res.data;
        elapsed += wait;
        if (!isTerminal(current.status)) await opts.onProgress?.(elapsed, `Apify run ${current.id} is ${current.status.toLowerCase()} (${elapsed}s)`);
    }
    return current;
}

async function collect(run: ApifyRun, limit: number, opts: ClientOptions): Promise<RunResult> {
    const data = await call<Record<string, unknown>[]>(
        `/datasets/${run.defaultDatasetId}/items?clean=true&format=json&limit=${limit}`,
        { method: 'GET' },
        opts,
    );
    const items = Array.isArray(data) ? data : [];
    if (TERMINAL_FAIL.has(run.status)) {
        // Items pushed before a timeout or abort are already paid for: return them rather than an error.
        if (items.length > 0) return { runId: run.id, status: run.status, finished: true, items };
        const detail = run.statusMessage ? `: ${run.statusMessage}` : '';
        throw new ApifyError(`The Apify run ${run.id} ended with status ${run.status}${detail}. Log: https://console.apify.com/view/runs/${run.id}`);
    }
    return { runId: run.id, status: run.status, finished: TERMINAL_OK.has(run.status), items };
}

/**
 * Starts an Actor run with the caller's own token (sent as a header, never in the URL), waits up to
 * MAX_WAIT_SECS, and returns the dataset items. If the run is still going, returns the items so far.
 */
export async function runActor(
    actorId: string,
    input: Record<string, unknown>,
    { maxItems, maxTotalChargeUsd }: StartOptions,
    opts: ClientOptions,
): Promise<RunResult> {
    const query =
        `?timeout=${RUN_TIMEOUT_SECS}&maxItems=${maxItems}&maxTotalChargeUsd=${maxTotalChargeUsd.toFixed(3)}&waitForFinish=0`;
    const started = await call<{ data: ApifyRun }>(
        `/acts/${actorId.replace('/', '~')}/runs${query}`,
        { method: 'POST', body: JSON.stringify(input) },
        opts,
    );
    const run = await waitForRun(started.data, opts);
    return collect(run, maxItems, opts);
}

/** Waits again on a run started earlier and returns its items. */
export async function getRunResults(runId: string, limit: number, opts: ClientOptions): Promise<RunResult & { actId: string }> {
    const res = await call<{ data: ApifyRun }>(`/actor-runs/${encodeURIComponent(runId)}`, { method: 'GET' }, opts);
    const run = await waitForRun(res.data, opts);
    return { ...(await collect(run, limit, opts)), actId: run.actId };
}

/**
 * Spending cap for a call: start fee plus per-item price for the requested number of items,
 * with 20 % headroom so rounding never cuts the last items, rounded up to a tenth of a cent.
 */
export function spendCap(startUsd: number, perItemUsd: number, items: number): number {
    return Math.ceil((startUsd + perItemUsd * items) * 1.2 * 1000) / 1000;
}
