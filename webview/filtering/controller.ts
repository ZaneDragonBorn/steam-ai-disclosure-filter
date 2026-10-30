import { Settings, shouldHide } from '../../shared/settings';
import { AIContentProvider } from '../steam/provider';
import { detectStoreCards } from '../steam/surfaces';
import { DisclosureBadges } from '../ui/badges';
import { CarouselPresentation } from '../ui/carousels';
import { SlotPresentation } from '../ui/slots';
import { ReactCarouselPresentation } from '../ui/reactCarousels';

const MARKER = 'data-ai-disclosure-filter-hidden';
import type { ReviewedApp } from '../../shared/history';
export class FilterController {
    private observer: MutationObserver;
    private retryTimer?: ReturnType<typeof setTimeout>;
    private tracked = new Map<HTMLElement, number>();

    private results = new Map<number, { value: boolean | null; expires: number; notes: string }>();
    private pending = new Set<number>();
    private style: HTMLStyleElement;
    private badges: DisclosureBadges;
    private carousels: CarouselPresentation;
    private slots: SlotPresentation;
    private reactCarousels: ReactCarouselPresentation;
    private timer?: ReturnType<typeof setTimeout>;
    private stopped = false;
    private settings: Settings = { mode: 'off', debug: false };
    constructor(
        private readonly doc: Document,
        private readonly provider: AIContentProvider,
        private readonly onReview: (
            apps: ReviewedApp[],
            hidden: number,
            checked: number,
            checking: boolean,
            unresolved: number,
            history: ReviewedApp[],
        ) => void = () => {},
    ) {
        this.style = doc.createElement('style');
        this.style.textContent = `[${MARKER}="true"] { display: none !important; }`;
        doc.head.append(this.style);
        this.badges = new DisclosureBadges(doc);
        this.carousels = new CarouselPresentation(doc);
        this.slots = new SlotPresentation(doc);
        this.reactCarousels = new ReactCarouselPresentation(doc);
        this.observer = new MutationObserver(() => this.schedule());
        this.observer.observe(doc.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['href', 'class'],
        });
    }
    update(settings: Settings): void {
        this.settings = settings;
        this.scan();
    }
    private schedule(): void {
        if (this.stopped || this.timer) return;
        this.timer = setTimeout(() => {
            this.timer = undefined;
            this.scan();
        }, 100);
    }
    scan(): void {
        if (this.stopped) return;
        const cards = detectStoreCards(this.doc);
        const current = new Set(cards.map((card) => card.element));
        for (const [element] of this.tracked) {
            if (!current.has(element)) {
                element.removeAttribute(MARKER);
                this.badges.remove(element);

                this.tracked.delete(element);
            }
        }
        for (const {
            element,
            appId,
            discovery,
            compact,
            wishlisted,
            owned,
            hover,
            wishlist,
        } of cards) {
            if (this.tracked.get(element) !== appId && this.settings.debug)
                console.debug('[AI Filter] detected App ID', appId);
            this.tracked.set(element, appId);
            const cached = this.results.get(appId);
            const result = cached && cached.expires > Date.now() ? cached.value : null;
            const policy = wishlist
                ? { ...this.settings, mode: this.settings.wishlistMode ?? 'off' }
                : discovery
                  ? { ...this.settings, mode: this.settings.discoveryMode ?? 'off' }
                  : this.settings;
            const exemptDiscovery =
                discovery &&
                ((this.settings.preserveWishlist !== false && wishlisted) ||
                    (this.settings.preserveOwned === true && owned));
            const hide =
                !hover && !exemptDiscovery && shouldHide(policy, appId, result, cached?.notes);
            this.badges.update(
                element,
                appId,
                this.settings.showAITags === false ? false : result,
                cached?.notes ?? '',
                compact,
            );
            if (hide) element.setAttribute(MARKER, 'true');
            else element.removeAttribute(MARKER);
            if ((!cached || cached.expires <= Date.now()) && !this.pending.has(appId)) {
                this.pending.add(appId);
                void this.provider
                    .hasAIDisclosure(appId)
                    .catch(() => null)
                    .then((value) => {
                        if (this.stopped) return;
                        this.results.set(appId, {
                            value,
                            notes: value === true ? (this.provider.getNotes?.(appId) ?? '') : '',
                            expires:
                                Date.now() +
                                (value === null ? 30_000 : value ? 86400_000 : 21600_000),
                        });
                        if (this.results.size > 1000)
                            this.results.delete(this.results.keys().next().value!);
                        if (this.settings.debug)
                            console.debug(
                                '[AI Filter] disclosure',
                                appId,
                                value === true
                                    ? 'disclosed'
                                    : value === false
                                      ? 'no disclosure found'
                                      : 'unknown',
                            );
                        this.schedule();
                    })
                    .finally(() => {
                        this.pending.delete(appId);
                        this.schedule();
                    });
            }
        }
        this.slots.update();
        this.carousels.update();
        this.reactCarousels.update();
        const reviewed = new Map<number, ReviewedApp>();
        const history = new Map<number, ReviewedApp>();
        let hidden = 0,
            checked = 0,
            unresolved = 0;
        for (const { element, appId, discovery } of cards) {
            const result = this.results.get(appId);
            if (result?.value === true && result.expires > Date.now())
                history.set(appId, {
                    appId,
                    notes: result.notes,
                    ...this.provider.getMetadata?.(appId),
                    hidden: element.hasAttribute(MARKER),
                    title:
                        this.provider.getMetadata?.(appId)?.title ||
                        this.cardTitle(element) ||
                        element.querySelector('img')?.alt ||
                        `App ${appId}`,
                    allowed: this.settings.allowedApps?.includes(appId) ?? false,
                });
            if (discovery) continue; // Quick review and counts describe filterable lists only.
            if (element.hasAttribute(MARKER)) hidden++;
            if (result && result.expires > Date.now()) {
                checked++;
                if (result.value === null) unresolved++;
                if (result.value === true)
                    reviewed.set(appId, {
                        appId,
                        notes: result.notes,
                        ...this.provider.getMetadata?.(appId),
                        hidden: element.hasAttribute(MARKER),
                        title:
                            this.provider.getMetadata?.(appId)?.title ||
                            this.cardTitle(element) ||
                            element.querySelector('img')?.alt ||
                            `App ${appId}`,
                        allowed: this.settings.allowedApps?.includes(appId) ?? false,
                    });
            }
        }
        this.onReview(
            [...reviewed.values()],
            hidden,
            checked,
            cards.some((card) => !card.discovery && this.pending.has(card.appId)),
            unresolved,
            [...history.values()],
        );
        // Retry unresolved/expired results automatically, without caching a queue
        // rejection for the lifetime of the page. Providers enforce HTTP cooldowns.
        if (!this.retryTimer && cards.length)
            this.retryTimer = setTimeout(() => {
                this.retryTimer = undefined;
                this.scan();
            }, 30_100);
    }
    private cardTitle(element: HTMLElement): string {
        const title = element
            .querySelector('.StoreSaleWidgetTitle, .title, .P-zVPa2bdmQ-')
            ?.cloneNode(true) as HTMLElement | undefined;
        title?.querySelectorAll('[data-aif-badge]').forEach((badge) => badge.remove());
        return title?.textContent?.trim() ?? '';
    }
    stop(): void {
        this.stopped = true;
        clearTimeout(this.timer);
        this.observer.disconnect();
        clearTimeout(this.retryTimer);
        this.badges.stop();
        for (const element of this.tracked.keys()) element.removeAttribute(MARKER);
        this.slots.stop();
        this.carousels.stop();
        this.reactCarousels.stop();
        this.tracked.clear();
        this.results.clear();
        this.style.remove();
    }
}
