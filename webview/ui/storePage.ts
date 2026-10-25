import { disclosureTier, Settings } from '../../shared/settings';
import {
    AIContentProvider,
    appIdFromURL,
    officialDisclosureSection,
    parseDisclosure,
} from '../steam/provider';

/** Read-only game-page context. Filtering never hides the opened game page. */
export class StorePageDisclosure {
    private row?: HTMLDetailsElement;
    private observer: MutationObserver;
    private timer?: ReturnType<typeof setTimeout>;
    private stopped = false;
    private lookup?: { id: number; value: boolean | null; notes: string };
    private pending?: number;
    private style: HTMLStyleElement;
    private settings: Pick<Settings, 'showAITags' | 'showStoreDisclosure'> = {};
    constructor(
        private readonly doc: Document,
        private readonly provider: AIContentProvider,
    ) {
        this.style = doc.createElement('style');
        this.style.textContent = `[data-aif-store-disclosure]{margin:10px 0;padding:8px 10px;border-left:2px solid #4c7b96;background:rgba(0,0,0,.2);color:#acb2b8;font:12px/1.5 Arial,sans-serif}
[data-aif-store-disclosure]>summary{cursor:pointer;color:#67c1f5;user-select:none}
[data-aif-store-disclosure] p{margin:8px 0 0;white-space:pre-wrap;overflow-wrap:anywhere}`;
        doc.head.append(this.style);
        this.observer = new MutationObserver(() => {
            if (this.stopped || this.timer) return;
            this.timer = setTimeout(() => {
                this.timer = undefined;
                this.update();
            }, 100);
        });
        this.observer.observe(doc.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['href'],
        });
    }
    update(settings?: Pick<Settings, 'showAITags' | 'showStoreDisclosure'>): void {
        if (settings) this.settings = settings;
        if (this.stopped) return;
        if (this.settings.showStoreDisclosure === false) {
            this.remove();
            return;
        }
        const id = appIdFromURL(this.doc.location.href);
        const canonical =
            this.doc.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ??
            this.doc.querySelector('meta[property="og:url"]')?.getAttribute('content') ??
            '';
        const host = this.doc.querySelector<HTMLElement>('#glanceMidCtn');
        if (
            id === null ||
            appIdFromURL(canonical) !== id ||
            !host ||
            !this.doc.querySelector('#appHubAppName') ||
            this.doc.querySelector('#agecheck_form')
        ) {
            this.remove();
            return;
        }
        const local = parseDisclosure(this.doc, id);
        const notes =
            local === true
                ? (officialDisclosureSection(this.doc)
                      ?.querySelector('i')
                      ?.textContent?.trim()
                      .slice(0, 10000) ?? '')
                : this.lookup?.id === id
                  ? this.lookup.notes
                  : '';
        const value = local ?? (this.lookup?.id === id ? this.lookup.value : null);
        if (value !== true) {
            this.remove();
        } else this.render(host, notes);
        if (local === null && this.lookup?.id !== id && this.pending !== id) {
            this.pending = id;
            void this.provider
                .hasAIDisclosure(id)
                .catch(() => null)
                .then((result) => {
                    if (this.stopped) return;
                    this.lookup = {
                        id,
                        value: result,
                        notes: result === true ? (this.provider.getNotes?.(id) ?? '') : '',
                    };
                    this.update();
                })
                .finally(() => {
                    if (this.pending === id) this.pending = undefined;
                });
        }
    }
    private render(host: HTMLElement, notes: string): void {
        const tier = disclosureTier(notes);
        if (!this.row || !host.contains(this.row)) {
            this.row?.remove();
            this.row = this.doc.createElement('details');
            this.row.setAttribute('data-aif-store-disclosure', '');
            const summary = this.doc.createElement('summary');
            summary.append('Generative AI disclosure ');
            const badge = this.doc.createElement('span');
            summary.append(badge);
            this.row.append(summary, this.doc.createElement('p'));
            host.append(this.row);
        }
        const badge = this.row.querySelector('span')!;
        badge.hidden = this.settings.showAITags === false;
        // The badge's shared display rule must not override the hidden flag.
        badge.style.display = this.settings.showAITags === false ? 'none' : '';
        if (badge.textContent !== tier.label) badge.textContent = tier.label;
        if (badge.getAttribute('data-aif-badge') !== tier.key)
            badge.setAttribute('data-aif-badge', tier.key);
        if (badge.title !== tier.reason) badge.title = tier.reason;
        const paragraph = this.row.querySelector('p')!,
            text =
                notes ||
                'Steam reports a generative AI disclosure. Disclosure text is unavailable.';
        if (paragraph.textContent !== text) paragraph.textContent = text;
    }
    private remove(): void {
        this.row?.remove();
        this.row = undefined;
    }
    stop(): void {
        this.stopped = true;
        clearTimeout(this.timer);
        this.observer.disconnect();
        this.remove();
        this.style.remove();
    }
}
