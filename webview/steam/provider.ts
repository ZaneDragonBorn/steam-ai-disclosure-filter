/** false means no disclosure found on a validated page, never "AI-free". */
export interface AppMetadata {
    title?: string;
    reviewCount?: number;
    percentPositive?: number;
}
export interface AIContentProvider {
    hasAIDisclosures?(ids: number[]): Promise<Map<number, boolean | null>>;
    getMetadata?(appId: number): AppMetadata | undefined;
    hasAIDisclosure(appId: number): Promise<boolean | null>;
    getNotes?(appId: number): string | undefined;
}

export function validAppId(value: number): boolean {
    return Number.isSafeInteger(value) && value > 0 && value <= 0xffffffff;
}

export function officialDisclosureSection(doc: Document): HTMLElement | undefined {
    return [...doc.querySelectorAll<HTMLElement>('[id="game_area_content_descriptors"]')].find(
        (section) =>
            section.querySelector(':scope > h2')?.textContent?.trim() ===
            'AI Generated Content Disclosure',
    );
}

export function appIdFromURL(
    value: string,
    base = 'https://store.steampowered.com/',
): number | null {
    try {
        const url = new URL(value, base);
        if (url.origin !== 'https://store.steampowered.com') return null;
        const match = /^\/app\/(\d+)(?:\/|$)/.exec(url.pathname);
        const id = match ? Number(match[1]) : 0;
        return validAppId(id) ? id : null;
    } catch {
        return null;
    }
}

/** Observed on Steam 2026-10-19. The descriptor ID also holds mature content;
 * require its direct heading, not keyword matches in descriptions/reviews. */
export function parseDisclosure(doc: Document, appId: number): boolean | null {
    const canonical =
        doc.querySelector('link[rel="canonical"]')?.getAttribute('href') ??
        doc.querySelector('meta[property="og:url"]')?.getAttribute('content');
    if (
        !canonical ||
        appIdFromURL(canonical) !== appId ||
        !doc.querySelector('#appHubAppName') ||
        !doc.querySelector('#game_area_description') ||
        doc.querySelector('#agecheck_form')
    )
        return null;
    const sections = [...doc.querySelectorAll('[id="game_area_content_descriptors"]')];
    for (const section of sections) {
        const heading = section.querySelector(':scope > h2')?.textContent?.trim();
        if (heading === 'AI Generated Content Disclosure') return true;
    }
    // A localized/incomplete page must not produce a negative finding.
    const aboutHeading = doc.querySelector('#game_area_description h2')?.textContent?.trim();
    return aboutHeading === 'About This Game' || aboutHeading === 'About This Software'
        ? false
        : null;
}

export class SteamHTMLProvider implements AIContentProvider {
    private notes = new Map<number, string>();
    getNotes(appId: number): string | undefined {
        return this.notes.get(appId);
    }
    private cooldownUntil = 0;
    private active = new Set<AbortController>();
    private stopped = false;
    constructor(private readonly fetcher: typeof fetch = fetch.bind(globalThis)) {}
    cancel(): void {
        this.stopped = true;
        for (const controller of this.active) controller.abort();
    }
    async hasAIDisclosure(appId: number): Promise<boolean | null> {
        this.notes.delete(appId);
        if (this.stopped || !validAppId(appId) || Date.now() < this.cooldownUntil) return null;
        const controller = new AbortController();
        this.active.add(controller);
        const timeout = setTimeout(() => controller.abort(), 10_000);
        try {
            const response = await this.fetcher(
                `https://store.steampowered.com/app/${appId}/?l=english`,
                {
                    credentials: 'omit',
                    signal: controller.signal,
                    redirect: 'follow',
                },
            );
            if (response.status === 429 || response.status === 403 || response.status >= 500) {
                // No documented storefront quota. Back off instead of retrying every card.
                this.cooldownUntil = Date.now() + 5 * 60_000;
            }
            if (
                !response.ok ||
                appIdFromURL(response.url) !== appId ||
                !response.headers.get('content-type')?.includes('text/html')
            )
                return null;
            const html = await response.text();
            if (this.stopped) return null;
            if (html.length > 4_000_000) return null;
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const result = parseDisclosure(doc, appId);
            if (result === true) {
                const section = officialDisclosureSection(doc);
                this.notes.set(
                    appId,
                    section?.querySelector('i')?.textContent?.trim().slice(0, 10000) ?? '',
                );
                if (this.notes.size > 1000) this.notes.delete(this.notes.keys().next().value!);
            }
            return result;
        } catch (error) {
            console.warn('[AI Filter] Store-page lookup failed', error);
            return null;
        } finally {
            clearTimeout(timeout);
            this.active.delete(controller);
        }
    }
}
