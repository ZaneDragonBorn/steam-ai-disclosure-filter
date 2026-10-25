import { disclosureTier } from '../../shared/settings';

interface Marker {
    badge: HTMLElement;
    host: HTMLElement;
}
/** Metadata placements only. Steam's artwork and wishlist controls stay clear. */
export class DisclosureBadges {
    private markers = new Map<HTMLElement, Marker[]>();
    private style: HTMLStyleElement;
    constructor(private readonly doc: Document) {
        this.style = doc.createElement('style');
        this.style.textContent = `
[data-aif-badge]{display:inline-flex;align-items:center;vertical-align:middle;white-space:nowrap;font:10px/15px Arial,sans-serif;font-weight:600;letter-spacing:.2px;padding:0 4px;margin-left:6px;border:1px solid #57718a;border-radius:2px;color:#c9e8f7;background:#182a38;cursor:default;text-transform:none;flex-shrink:0}
[data-aif-badge=heavy]{border-color:#84734f;color:#eddbb5;background:#302b20}
[data-aif-badge][data-aif-footer]{margin:4px auto 4px 6px;align-self:center}
[data-aif-badge]:focus-visible{outline:2px solid #67c1f5;outline-offset:2px}
`;
        doc.head.append(this.style);
    }
    update(
        card: HTMLElement,
        appId: number,
        disclosed: boolean | null,
        notes: string,
        compact = false,
    ): void {
        if (disclosed !== true) {
            this.remove(card);
            return;
        }
        // Observed shared release/platform bar and homepage discount metadata bar,
        // Oct 2026. Compact cards can display both a footer and hover label.
        const footer =
            card.querySelector<HTMLElement>(
                '.CapsuleBottomBar, ._1_ehE8jTqsTDnx5E7Sqjy7, ._1-29ksrfQaORRCqN2AVf06',
            ) ??
            (card.matches('a.store_capsule')
                ? card.querySelector<HTMLElement>('.discount_block')?.parentElement
                : null);
        const hover =
            card.querySelector<HTMLElement>('[popover] .ReviewScore')?.parentElement ??
            card.querySelector<HTMLElement>('[popover] ._3WlfumeMCR40WR-uBdg3Gx');
        const hosts = new Set<HTMLElement>();
        if (compact) {
            if (footer) hosts.add(footer);
            if (hover) hosts.add(hover);
        } else {
            const review = card.querySelector<HTMLElement>('.ReviewScore');
            const title = card.querySelector<HTMLElement>(
                '.StoreSaleWidgetTitle, .search_name .title, .title, .home_smallcap_title, .tab_item_title, .app_name, ._3yPJAYRckrGOYnsQF9nnMD',
            );
            const price = card.querySelector<HTMLElement>('.StoreSalePriceWidgetContainer');
            const chartTitle = card.matches('tr')
                ? card.querySelector<HTMLElement>('td:nth-child(3) a div')
                : null;
            const host =
                review?.parentElement ??
                card.querySelector<HTMLElement>('.review_summary_row, .hover_review_summary') ??
                card.querySelector<HTMLElement>('.hover_title') ??
                chartTitle ??
                title ??
                footer ??
                price?.parentElement ??
                (card.matches('[popover]')
                    ? card.querySelector<HTMLElement>('._3WlfumeMCR40WR-uBdg3Gx')
                    : null) ??
                (card.matches('.community_recommendation_app')
                    ? card.querySelector<HTMLElement>('.discount_block')?.parentElement
                    : null);
            if (host) hosts.add(host);
        }
        const previous = this.markers.get(card) ?? [];
        const markers = previous.filter((marker) => {
            if (hosts.has(marker.host) && card.contains(marker.badge)) return true;
            marker.badge.remove();
            return false;
        });
        const tier = disclosureTier(notes);
        const tooltip = `${tier.label}\n${tier.reason}\n\nSteam AI disclosure:\n${notes || 'Disclosure text unavailable.'}`;
        for (const host of hosts) {
            let marker = markers.find((m) => m.host === host);
            if (!marker) {
                const badge = this.doc.createElement('span');
                badge.tabIndex = 0;
                badge.setAttribute('role', 'img');
                marker = { badge, host };
                markers.push(marker);
                if (host === footer) {
                    badge.setAttribute('data-aif-footer', '');
                    host.prepend(badge);
                } else host.append(badge);
            }
            const badge = marker.badge;
            if (badge.textContent !== tier.label) badge.textContent = tier.label;
            if (badge.title !== tooltip) {
                badge.title = tooltip;
                badge.setAttribute('aria-label', tooltip);
            }
            if (badge.getAttribute('data-aif-badge') !== tier.key)
                badge.setAttribute('data-aif-badge', tier.key);
            badge.dataset.appid = String(appId);
        }
        if (markers.length) this.markers.set(card, markers);
        else this.markers.delete(card);
    }
    remove(card: HTMLElement): void {
        for (const marker of this.markers.get(card) ?? []) marker.badge.remove();
        this.markers.delete(card);
    }
    stop(): void {
        for (const card of this.markers.keys()) this.remove(card);
        this.style.remove();
    }
}
