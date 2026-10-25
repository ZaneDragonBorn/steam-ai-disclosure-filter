import { appIdFromURL } from './provider';

export function isSupportedStore(url: string): boolean {
    try {
        const u = new URL(url);
        return (
            u.origin === 'https://store.steampowered.com' &&
            !/^\/(app|sub|bundle|account|checkout|cart|login|agecheck)(\/|$)/.test(u.pathname)
        );
    } catch {
        return false;
    }
}
// Shared sale/category components inspected on Next Fest, VR and category pages.
// Next Fest no longer wraps these in .sale_item_browser. Keep hashes isolated.
export const SALE_SIDEBAR = '._1tOSyFfIWM42bIEwzvMp8v';
export const SALE_FILTER_GROUP = '._3aX5FdS6RjfaN8MCACBPf5';
export const SALE_FILTER_HEADER = '._3nsXKzSSkXGctsyIBw1RIF';
export const SALE_FILTER_HEADING = '._3X8r5nTmkQJqI-YG8Vl91b';
// These attributes describe only our local presentation, never Steam's data.
export const PRESENTATION_HIDDEN = 'data-aif-slot-hidden';
const CARD_SELECTORS = [
    'a.search_result_row',
    '.LibraryAssetExpandedDisplay',
    '.StoreSaleWidgetOuterContainer',
    'a.store_main_capsule',
    'a.sale_capsule',
    'a.store_capsule',
    'a.home_headercap',
    '.community_recommendation_app',
    'a.tab_row_item',
    'tbody tr',
    '[data-key="hover div"]',
    '._3hxg83PMgvZaOaB_-m0mXX',
    '._229f53fK_tl7R6wqc-g2bq',
    'a.Ay0ys40M1NtzbqyKeNgwX',
].join(',');
export function filterHosts(doc: Document): HTMLElement[] {
    return isSupportedStore(doc.location.href)
        ? [...doc.querySelectorAll<HTMLElement>('#additional_search_options, ' + SALE_SIDEBAR)]
        : [];
}
export interface StoreCard {
    element: HTMLElement;
    appId: number;
    discovery: boolean;
    compact: boolean;
    wishlisted: boolean;
    owned?: boolean;
    hover?: boolean;
}
export function cardAppId(element: HTMLElement): number | null {
    const links = element.matches('a[href]')
        ? [element as HTMLAnchorElement]
        : [...element.querySelectorAll<HTMLAnchorElement>('a[href]')];
    const ids = new Set(
        links.map((a) => appIdFromURL(a.href)).filter((id): id is number => id !== null),
    );
    return ids.size === 1 ? [...ids][0] : null;
}
export function listingRoot(host: HTMLElement): HTMLElement | null {
    if (host.id === 'additional_search_options')
        return host.ownerDocument.querySelector('#search_resultsRows');
    // The sidebar's parent is the shared browser containing its associated cards.
    return host.closest('.sale_item_browser') ?? host.parentElement;
}
export function isWishlisted(element: HTMLElement): boolean {
    // Steam's legacy flag and the current React ds_wishlist_flag (official bundle,
    // Oct 2026). Dedicated wishlist shelves are protected before flags resolve.
    if (
        element.matches('.ds_wishlist') ||
        element.querySelector('.ds_wishlist,.ds_wishlist_flag,._3Rgc5idc13zGnjAaIpVNAR')
    )
        return true;
    const section = element.closest('.SaleSectionCtn');
    if (
        section &&
        [...section.querySelectorAll('h2,.SaleSectionHeader')].some((h) =>
            /^(on )?your wishlist$/i.test(h.textContent?.trim() ?? ''),
        )
    )
        return true;
    // home_page_content can wrap most of the homepage. A nested wishlist shelf
    // must not exempt the calendar and unrelated recommendation sections.
    const legacy = element.closest('.home_page_content');
    return (
        !!legacy &&
        [...legacy.querySelectorAll(':scope > h2,:scope > .SaleSectionHeader')].some((h) =>
            /^(on )?your wishlist$/i.test(h.textContent?.trim() ?? ''),
        )
    );
}

/** Shared capsule fallback: an official app link plus artwork for that same ID.
 * This covers calendar/recommendation variants without a growing class allowlist.
 * Navigation, mixed promotions and screenshot/editorial links are excluded. */
function hasAppCapsule(anchor: HTMLAnchorElement, appId: number): boolean {
    if (
        anchor.closest('nav,header,footer,[popover],#global_hover_content') ||
        anchor.matches('.home_page_takeover_sizer')
    )
        return false;
    return [...anchor.querySelectorAll<HTMLImageElement>('img')].some((img) => {
        try {
            const url = new URL(
                img.getAttribute('data-image-url') || img.currentSrc || img.src,
                anchor.baseURI,
            );
            return (
                /(^|\.)(steamstatic\.com|steamusercontent\.com)$/.test(url.hostname) &&
                new RegExp(`/apps/${appId}/`).test(url.pathname) &&
                /(header|capsule|library)/i.test(url.pathname)
            );
        } catch {
            return false;
        }
    });
}
export function isOwned(element: HTMLElement): boolean {
    // Official storefront bundle's ds_owned_flag, alongside legacy Steam flags.
    return (
        element.matches('.ds_owned,.ds_owned_flag,._1Ywwc4rP-p7ADlRoCRtVUb') ||
        !!element.querySelector('.ds_owned,.ds_owned_flag,._1Ywwc4rP-p7ADlRoCRtVUb')
    );
}
export function detectStoreCards(doc: Document): StoreCard[] {
    if (!isSupportedStore(doc.location.href)) return [];
    const roots = filterHosts(doc)
        .map(listingRoot)
        .filter((r): r is HTMLElement => !!r);
    // home.js BuildHomePageGenericCap/HeaderCap and community recommendation
    // builders reuse these classes across personalized shelves (Oct 2026).
    const candidates = new Set(doc.querySelectorAll<HTMLElement>(CARD_SELECTORS));
    // The same release/platform footer also appears in sale recommendation
    // anchors without either legacy wrapper. Detect that component structurally.
    for (const footer of doc.querySelectorAll<HTMLElement>(
        '.CapsuleBottomBar, ._1_ehE8jTqsTDnx5E7Sqjy7',
    )) {
        const anchor = footer.closest<HTMLAnchorElement>('a[href]');
        if (anchor?.querySelector('img') && !anchor.parentElement?.closest(CARD_SELECTORS))
            candidates.add(anchor);
    }
    for (const anchor of doc.querySelectorAll<HTMLAnchorElement>('a[href]')) {
        const appId = appIdFromURL(anchor.href);
        if (
            appId === null ||
            anchor.closest(CARD_SELECTORS) ||
            anchor.querySelector(CARD_SELECTORS)
        )
            continue;
        if (hasAppCapsule(anchor, appId)) candidates.add(anchor);
    }
    const cards: StoreCard[] = [];
    for (const element of candidates) {
        if (element.querySelector('.StoreSaleWidgetOuterContainer,.LibraryAssetExpandedDisplay'))
            continue;
        if (
            element.matches('[data-key="hover div"]') &&
            (element.parentElement?.closest(
                '.StoreSaleWidgetOuterContainer,.LibraryAssetExpandedDisplay,tr',
            ) ||
                !element.querySelector('.CapsuleImageCtn'))
        )
            continue;
        if (element.matches('tbody tr') && !element.querySelector('.StoreSalePriceWidgetContainer'))
            continue;
        const appId = cardAppId(element);
        if (appId === null) continue;
        let active = true;
        for (let node: HTMLElement | null = element; node; node = node.parentElement) {
            const locallyHidden =
                node.hasAttribute('data-ai-disclosure-filter-hidden') ||
                node.hasAttribute('data-aif-carousel-page-hidden') ||
                node.hasAttribute(PRESENTATION_HIDDEN) ||
                node.hasAttribute('data-aif-carousel-empty');
            if (
                node.hidden ||
                (!locallyHidden && doc.defaultView?.getComputedStyle(node).display === 'none')
            ) {
                active = false;
                break;
            }
        }
        if (!active) continue;
        cards.push({
            element,
            appId,
            discovery:
                !element.matches('a.search_result_row') &&
                !element.closest('.sale_item_browser') &&
                !roots.some((root) => root.contains(element)),
            compact:
                element.matches(
                    'a.sale_capsule,a.store_capsule,[data-key="hover div"],._229f53fK_tl7R6wqc-g2bq',
                ) ||
                (!element.querySelector('.StoreSaleWidgetTitle,.ReviewScore,.title') &&
                    element.matches('.StoreSaleWidgetOuterContainer')),
            wishlisted: isWishlisted(element),
            owned: isOwned(element),
        });
    }
    // Current category/sale hover popovers can be portalled outside their card.
    // Bind to the popup's own single app identity, never a remembered mouse target.
    for (const element of doc.querySelectorAll<HTMLElement>('[popover]')) {
        if (element.parentElement?.closest(CARD_SELECTORS)) continue;
        if (!element.querySelector('.ReviewScore,._3WlfumeMCR40WR-uBdg3Gx')) continue;
        const appId = cardAppId(element);
        if (appId !== null)
            cards.push({
                element,
                appId,
                discovery: true,
                compact: false,
                wishlisted: false,
                hover: true,
            });
    }
    // Steam's legacy GameHover caches each app under its own stable ID. Never
    // infer the hovered title from mouse position, which can race popup recycling.
    for (const element of doc.querySelectorAll<HTMLElement>(
        '#global_hover_content > [id^="hover_app_"]',
    )) {
        const id = Number(element.id.slice('hover_app_'.length));
        if (Number.isSafeInteger(id) && id > 0 && id <= 0xffffffff)
            cards.push({
                element,
                appId: id,
                discovery: true,
                compact: false,
                wishlisted: false,
                hover: true,
            });
    }
    return cards;
}
