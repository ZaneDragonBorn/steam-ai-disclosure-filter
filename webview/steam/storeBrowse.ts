import { AIContentProvider, SteamHTMLProvider, validAppId, AppMetadata } from './provider';
function object(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}
function matchingItem(payload: unknown, id: number) {
    const items = object(object(payload)?.response)?.store_items;
    return Array.isArray(items)
        ? items
              .map(object)
              .find(
                  (i) =>
                      i?.appid === id &&
                      i.id === id &&
                      i.item_type === 0 &&
                      i.success === 1 &&
                      i.visible === true,
              )
        : undefined;
}
export function parseStoreBrowse(payload: unknown, id: number): boolean | null {
    const details = object(matchingItem(payload, id)?.extra_details);
    if (!details) return null;
    const notes = details.content_survey_ai_notes;
    return notes === undefined ? false : typeof notes === 'string' ? notes.trim().length > 0 : null;
}
export class SteamDisclosureProvider implements AIContentProvider {
    private notes = new Map<number, string>();
    private metadata = new Map<number, AppMetadata>();
    private apiUnavailableUntil = 0;
    private cooldownUntil = 0;
    private active = new Set<AbortController>();
    private stopped = false;
    // Shared by both batches: HTML fallback must not become a request storm.
    private fallbackActive = 0;
    private fallbackWaiters: (() => void)[] = [];
    constructor(
        private readonly fallback = new SteamHTMLProvider(),
        private readonly fetcher: typeof fetch = fetch.bind(globalThis),
    ) {}
    getNotes(id: number) {
        return this.notes.get(id) ?? this.fallback.getNotes(id);
    }
    getMetadata(id: number) {
        return this.metadata.get(id);
    }
    cancel(): void {
        this.stopped = true;
        for (const controller of this.active) controller.abort();
        this.fallback.cancel();
        for (const resolve of this.fallbackWaiters.splice(0)) resolve();
    }
    async hasAIDisclosure(id: number): Promise<boolean | null> {
        return (await this.hasAIDisclosures([id])).get(id) ?? null;
    }
    private async html(id: number): Promise<boolean | null> {
        if (this.stopped) return null;
        if (this.fallbackActive >= 4)
            await new Promise<void>((resolve) => this.fallbackWaiters.push(resolve));
        else this.fallbackActive++;
        if (this.stopped) return null;
        try {
            return await this.fallback.hasAIDisclosure(id);
        } finally {
            const next = this.fallbackWaiters.shift();
            if (next) next();
            else this.fallbackActive--;
        }
    }
    async hasAIDisclosures(requested: number[]): Promise<Map<number, boolean | null>> {
        const ids = [...new Set(requested.filter(validAppId))];
        const results = new Map<number, boolean | null>(ids.map((id) => [id, null]));
        if (this.stopped || !ids.length || Date.now() < this.cooldownUntil) return results;
        if (ids.length > 40) throw new Error('StoreBrowse batch exceeds 40 IDs');
        let unresolved = ids;
        if (Date.now() >= this.apiUnavailableUntil) {
            const controller = new AbortController();
            this.active.add(controller);
            const timeout = setTimeout(() => controller.abort(), 10_000);
            try {
                const input = {
                    ids: ids.map((appid) => ({ appid })),
                    context: { language: 'english', country_code: 'US' },
                    data_request: { include_extra_details: true, include_reviews: true },
                };
                const response = await this.fetcher(
                    'https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=' +
                        encodeURIComponent(JSON.stringify(input)),
                    { credentials: 'omit', signal: controller.signal },
                );
                if (response.status === 429 || response.status === 403 || response.status >= 500) {
                    this.cooldownUntil = Date.now() + 300_000;
                    return results;
                }
                if (
                    response.ok &&
                    response.headers.get('content-type')?.includes('application/json')
                ) {
                    const payload: unknown = await response.json();
                    if (this.stopped) return results;
                    for (const id of ids) {
                        const result = parseStoreBrowse(payload, id);
                        results.set(id, result);
                        if (result === false) {
                            this.notes.delete(id);
                            this.metadata.delete(id);
                        }
                        const item = matchingItem(payload, id);
                        if (result === true) {
                            const notes = object(item?.extra_details)?.content_survey_ai_notes;
                            this.notes.set(
                                id,
                                typeof notes === 'string' ? notes.slice(0, 10000) : '',
                            );
                            const summary = object(object(item?.reviews)?.summary_filtered);
                            this.metadata.set(id, {
                                title: typeof item?.name === 'string' ? item.name : undefined,
                                reviewCount:
                                    typeof summary?.review_count === 'number'
                                        ? summary.review_count
                                        : undefined,
                                percentPositive:
                                    typeof summary?.percent_positive === 'number'
                                        ? summary.percent_positive
                                        : undefined,
                            });
                        }
                    }
                    unresolved = ids.filter((id) => results.get(id) === null);
                }
            } catch (error) {
                console.warn('[AI Filter] Structured lookup failed', error);
                if (controller.signal.aborted) return results;
                this.apiUnavailableUntil = Date.now() + 300_000;
            } finally {
                clearTimeout(timeout);
                this.active.delete(controller);
            }
        }
        await Promise.all(unresolved.map(async (id) => results.set(id, await this.html(id))));
        while (this.notes.size > 1000) this.notes.delete(this.notes.keys().next().value!);
        while (this.metadata.size > 1000) this.metadata.delete(this.metadata.keys().next().value!);
        return results;
    }
}
