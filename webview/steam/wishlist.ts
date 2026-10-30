/** Wishlist SSR markup inspected in expanded/compact views, Oct 2026.
 * Steam measures data-index rows with ResizeObserver; preserve indices/ranks. */
export const WISHLIST_ENTRY = '.PE-3oq-yIvg-';
export const WISHLIST_TITLE = '.P-zVPa2bdmQ-';
export const WISHLIST_METADATA = '.uQ8Li0MwEhQ-';
export const WISHLIST_FILTER_CHIP = 'cDJOlrqyRq8- n5jTCXrzS8A- Focusable';

/** The native chip row remains mounted when empty. Avoid unrelated Panel nodes. */
export function wishlistActiveFilters(doc: Document): HTMLElement | null {
    if (!isWishlistURL(doc.location.href)) return null;
    const root = doc.querySelector('.awGgT3ZKumU-');
    if (!root?.querySelector(':scope > .DFhzzTUhoEs-')) return null;
    const rows = [...root.children].filter(
        (node): node is HTMLElement =>
            node.className === 'Panel' &&
            [...node.children].every((child) =>
                child.matches('button.cDJOlrqyRq8-,button[data-aif-wishlist-active]'),
            ),
    );
    return rows.length === 1 ? rows[0] : null;
}
export function isWishlistURL(value: string): boolean {
    try {
        const url = new URL(value);
        return (
            url.origin === 'https://store.steampowered.com' &&
            /^\/wishlist(?:\/|$)/.test(url.pathname)
        );
    } catch {
        return false;
    }
}
export function wishlistRows(doc: Document): HTMLElement[] {
    if (!isWishlistURL(doc.location.href)) return [];
    const rows = new Set<HTMLElement>();
    for (const entry of doc.querySelectorAll<HTMLElement>(`.PLkUpk974nY- ${WISHLIST_ENTRY}`)) {
        const row = entry.closest<HTMLElement>('[data-index]');
        if (row && row.querySelectorAll(WISHLIST_ENTRY).length === 1) rows.add(row);
    }
    return [...rows];
}
/** Options is identified by its native schema, independent of translated text. */
export function wishlistOptions(doc: Document): HTMLFormElement[] {
    if (!isWishlistURL(doc.location.href)) return [];
    return [...doc.querySelectorAll<HTMLFormElement>('form')].filter(
        (form) =>
            !!form.querySelector('input[name="viewmode"]') &&
            !!form.querySelector('input[name="platform"]'),
    );
}
