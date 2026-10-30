import { PRESENTATION_HIDDEN } from '../steam/surfaces';
import { appIdFromURL } from '../steam/provider';
import { isWishlistURL } from '../steam/wishlist';

const HIDDEN = 'data-ai-disclosure-filter-hidden';
/** Observed shared category/event grid cells and homepage promotion columns.
 * Hide the layout cell, not just its inner capsule. Never detach React nodes or
 * compact a mixed promotion/group containing any unblocked/unknown content. */
export class SlotPresentation {
    private hidden = new Set<HTMLElement>();
    private compacted = new Set<HTMLElement>();
    private replacements = new Map<HTMLElement, HTMLElement>();
    private style: HTMLStyleElement;
    constructor(private readonly doc: Document) {
        this.style = doc.createElement('style');
        this.style.textContent = `[${PRESENTATION_HIDDEN}]{display:none!important}
[data-aif-compact-grid]{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
[data-aif-compact-grid]>.SaleSectionContainer{display:contents!important}
[data-aif-compact-grid]>.SaleSectionContainer>*{min-width:0}
[data-aif-hidden-feature]{box-sizing:border-box;flex:1 1 0;min-width:0;min-height:240px;aspect-ratio:2.2;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:8px;padding:24px;text-align:center;background:rgba(0,0,0,.2);color:#acb2b8;font:14px/1.5 Arial,sans-serif}
[data-aif-hidden-feature]>strong{font-size:16px;color:#c6d4df}
[data-aif-hidden-feature=slide]{width:100%;height:100%;aspect-ratio:auto;min-height:240px}
[data-aif-hidden-feature][data-aif-replacement-overlay]{position:absolute;inset:0;min-height:0}
@media(max-width:750px){[data-aif-compact-grid]{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:500px){[data-aif-compact-grid]{grid-template-columns:minmax(0,1fr)}}`;
        doc.head.append(this.style);
    }
    update(): void {
        const next = new Set<HTMLElement>();
        // New calendar/recommendation variants often add a single-child wrapper
        // around the app anchor. Collapse that wrapper too, stopping at indexed
        // carousel pages or multi-card containers owned by Steam.
        for (const card of this.doc.querySelectorAll<HTMLElement>(`[${HIDDEN}]`)) {
            // Wishlist's virtualizer owns row measurement and track geometry.
            if (isWishlistURL(this.doc.location.href)) continue;
            let node = card.parentElement;
            for (let depth = 0; node && depth < 4; depth++, node = node.parentElement) {
                if (
                    !node.matches('div,li,article') ||
                    node.children.length !== 1 ||
                    node.matches(
                        '.carousel__slide,.carousel_items,.carousel_container,.SaleSectionContainer,.carousel,.HlkukqE4fB5si76sBJzKX',
                    )
                )
                    break;
                next.add(node);
            }
        }
        const groups = this.doc.querySelectorAll<HTMLElement>(
            '.SaleSectionContainer, ._3gVAXLzTzt5xCjFA1_c9rn',
        );
        for (const group of groups) {
            const cells = [...group.children] as HTMLElement[];
            for (const cell of cells) {
                const links = [...cell.querySelectorAll<HTMLAnchorElement>('a[href]')];
                // A sale/event link is a promotion, not an application. Preserve
                // it even if an adjacent app happens to be blocked.
                if (links.length && links.every((link) => !!link.closest(`[${HIDDEN}]`)))
                    next.add(cell);
            }
            if (cells.length && cells.every((cell) => next.has(cell) || cell.hasAttribute(HIDDEN)))
                next.add(group);
        }
        for (const element of this.hidden)
            if (!next.has(element)) element.removeAttribute(PRESENTATION_HIDDEN);
        for (const element of next)
            if (!element.hasAttribute(PRESENTATION_HIDDEN))
                element.setAttribute(PRESENTATION_HIDDEN, '');
        this.hidden = next;
        const compacted = new Set<HTMLElement>();
        // Steam puts 2-card and 3-card rows in the same React slide. Flatten
        // only that verified wrapper with CSS so surviving cards pack together;
        // React keeps the original DOM ownership and carousel page indices.
        for (const page of this.doc.querySelectorAll<HTMLElement>('.HlkukqE4fB5si76sBJzKX')) {
            const rows = [...page.children] as HTMLElement[];
            if (
                rows.length > 1 &&
                rows.every((row) => row.matches('.SaleSectionContainer')) &&
                rows.some((row) => [...row.children].some((cell) => next.has(cell as HTMLElement)))
            )
                compacted.add(page);
        }
        for (const page of this.compacted)
            if (!compacted.has(page)) page.removeAttribute('data-aif-compact-grid');
        for (const page of compacted)
            if (!page.hasAttribute('data-aif-compact-grid'))
                page.setAttribute('data-aif-compact-grid', '');
        this.compacted = compacted;
        const fixed = new Map<
            HTMLElement,
            { parent: HTMLElement; after?: HTMLElement; slide?: boolean; overlay?: boolean }
        >();
        // Shared category video rows can add wrappers around the current feature.
        // Insert outside hidden wrappers, leaving Steam's arrows and nodes intact.
        for (const card of this.doc.querySelectorAll<HTMLElement>(
            '.VideoRow ._3hxg83PMgvZaOaB_-m0mXX',
        )) {
            if (!card.hasAttribute(HIDDEN) && !this.fullyBlocked(card)) continue;
            const row = card.closest('.VideoRow')!;
            let after = card;
            while (
                after.parentElement &&
                after.parentElement !== row &&
                (after.parentElement.hasAttribute(PRESENTATION_HIDDEN) ||
                    after.parentElement.hasAttribute(HIDDEN))
            )
                after = after.parentElement;
            if (after.parentElement) fixed.set(card, { parent: after.parentElement, after });
        }
        // Category scrolling panels retain indexed slide widths, often without
        // one dot per slide. A fully blocked panel cannot simply disappear from
        // that track. Give the retained slot a replacement; partial grids reflow
        // above as before. No unknown or promotion links may be covered.
        for (const slide of this.doc.querySelectorAll<HTMLElement>('.carousel__slide')) {
            if (!this.fullyBlocked(slide)) continue;
            for (const key of fixed.keys()) if (slide.contains(key)) fixed.delete(key);
            const inner = slide.querySelector<HTMLElement>(':scope > .carousel__inner-slide');
            fixed.set(slide, {
                parent: slide,
                slide: true,
                overlay:
                    !!inner &&
                    this.doc.defaultView?.getComputedStyle(inner).position === 'absolute',
            });
        }
        for (const [card, replacement] of this.replacements) {
            if (!fixed.has(card) || replacement.parentElement !== fixed.get(card)!.parent) {
                replacement.remove();
                this.replacements.delete(card);
            }
        }
        for (const [card, placement] of fixed) {
            if (this.replacements.has(card)) continue;
            const replacement = this.doc.createElement('div');
            replacement.setAttribute(
                'data-aif-hidden-feature',
                placement.slide ? 'slide' : 'feature',
            );
            replacement.setAttribute('role', 'note');
            if (placement.overlay) replacement.setAttribute('data-aif-replacement-overlay', '');
            const title = this.doc.createElement('strong');
            title.textContent = 'Hidden by AI filter';
            const hint = this.doc.createElement('span');
            hint.textContent = `Change your Discovery filter settings to show ${placement.slide ? 'these titles' : 'this title'}.`;
            replacement.append(title, hint);
            if (placement.after) placement.after.after(replacement);
            else placement.parent.append(replacement);
            this.replacements.set(card, replacement);
        }
    }
    private fullyBlocked(element: HTMLElement): boolean {
        const links = [...element.querySelectorAll<HTMLAnchorElement>('a[href]')];
        return (
            links.some((a) => appIdFromURL(a.href) !== null) &&
            links.every((a) => !!a.closest(`[${HIDDEN}]`))
        );
    }
    stop(): void {
        for (const element of this.hidden) element.removeAttribute(PRESENTATION_HIDDEN);
        for (const page of this.compacted) page.removeAttribute('data-aif-compact-grid');
        for (const replacement of this.replacements.values()) replacement.remove();
        this.replacements.clear();
        this.hidden.clear();
        this.compacted.clear();
        this.style.remove();
    }
}
