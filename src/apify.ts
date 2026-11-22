export const APIFY_API = 'https://api.apify.com/v2';

export class ApifyError extends Error {
    constructor(message: string, readonly status?: number) {
        super(message);
        this.name = 'ApifyError';
    }
}

export interface RunOptions {
    token: string | undefined;
    /** Upper bound on dataset items (Apify enforces it for pay-per-result Actors only). */
    maxItems: number;
    /** Upper bound on what the run may charge, enforced by Apify for pay-per-event Actors. */
    maxTotalChargeUsd: number;
    /** Seconds Apify waits for the run before giving up. run-sync allows up to 300. */
    timeoutSecs?: number;
    fetchImpl?: typeof fetch;
}

/**
 * Runs an Apify Actor synchronously and returns its dataset items.
 * The caller's own Apify token is sent in the Authorization header, never in the URL.
 */
export async function runActor(
    actorId: string,
    input: Record<string, unknown>,
    { token, maxItems, maxTotalChargeUsd, timeoutSecs = 120, fetchImpl = fetch }: RunOptions,
): Promise<Record<string, unknown>[]> {
    if (!token) {
        throw new ApifyError(
            'APIFY_TOKEN is not set. Add it to the env block of this MCP server in your client config. ' +
                'Get a token at https://console.apify.com/settings/integrations',
        );
    }
    const url =
        `${APIFY_API}/acts/${actorId.replace('/', '~')}/run-sync-get-dataset-items` +
        `?timeout=${timeoutSecs}&maxItems=${maxItems}&maxTotalChargeUsd=${maxTotalChargeUsd.toFixed(4)}&format=json&clean=true`;

    let res: Response;
    try {
        res = await fetchImpl(url, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
    } catch (err) {
        throw new ApifyError(`Could not reach the Apify API: ${(err as Error).message}`);
    }

    const text = await res.text();
    if (!res.ok) {
        let message = text.slice(0, 300);
        try {
            const parsed = JSON.parse(text) as { error?: { message?: string } };
            if (parsed.error?.message) message = parsed.error.message;
        } catch {
            /* keep raw text */
        }
        throw new ApifyError(`Apify returned HTTP ${res.status}: ${message}`, res.status);
    }

    const data = JSON.parse(text) as unknown;
    if (!Array.isArray(data)) throw new ApifyError('Unexpected Apify response: expected an array of dataset items.');
    return data as Record<string, unknown>[];
}
