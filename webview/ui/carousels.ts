import { appIdFromURL } from '../steam/provider';
const HIDDEN = 'data-ai-disclosure-filter-hidden';
const SKIP = 'data-aif-carousel-skip';
const PAGE = 'data-aif-carousel-page-hidden';
interface NativeCarousel {
    $elContainer?: { [index: number]: HTMLElement };
    Advance: (index?: number) => void;
    UpdateNearbyItems?: () => void;
    UpdateControls?: () => void;
}
interface State {
    items: HTMLElement[];
    thumbs: HTMLElement[];
    mask: string;
    attemptedFocus?: HTMLElement;
}
/** Steam's CGenericCarousel already skips display:none entries when advancing.
 * Preserve its original arrays/indices; never detach/reorder Steam-owned nodes.
 * Verified against public main.js and home.js, Oct 2026. */
export class CarouselPresentation {
    private states = new Map<HTMLElement, State>();
    private style: HTMLStyleElement;
    constructor(private readonly doc: Document) {
        this.style = doc.createElement('style');
        this.style.textContent = `
[${SKIP}],[${PAGE}]{display:none!important}
[data-aif-carousel-empty]{display:none!important}
`;
        doc.head.append(this.style);
    }
    update(): void {
        const roots = [
            ...this.doc.querySelectorAll<HTMLElement>(
                '.carousel_container.maincap, .carousel_container.paging_capsules',
            ),
        ];
        for (const [root, state] of this.states)
            if (!roots.includes(root)) {
                this.restore(root, state);
                this.states.delete(root);
            }
        for (const root of roots) {
            const list = root.querySelector<HTMLElement>('.carousel_items');
            if (!list) {
                const previous = this.states.get(root);
                if (previous) {
                    this.restore(root, previous);
                    this.states.delete(root);
                }
                continue;
            }
            const items = [...list.children].filter(
                (e): e is HTMLElement => e instanceof this.doc.defaultView!.HTMLElement,
            );
            if (
                !items.length ||
                !items.every((e) =>
                    root.matches('.maincap')
                        ? e.matches('a.store_main_capsule')
                        : e.tagName === 'DIV',
                )
            ) {
                const previous = this.states.get(root);
                if (previous) {
                    this.restore(root, previous);
                    this.states.delete(root);
                }
                continue;
            }
            const thumbs = [
                ...(root.querySelector<HTMLElement>('.carousel_thumbs')?.children ?? []),
            ] as HTMLElement[];
            const mask = items
                .map((e) => {
                    if (e.hasAttribute(HIDDEN)) return '1';
                    if (!root.matches('.paging_capsules')) return '0';
                    const links = [...e.querySelectorAll<HTMLAnchorElement>('a[href]')];
                    return links.some((a) => appIdFromURL(a.href) !== null) &&
                        links.every((a) => !!a.closest(`[${HIDDEN}]`))
                        ? '1'
                        : '0';
                })
                .join('');
            let state = this.states.get(root);
            const changed =
                !state ||
                mask !== state.mask ||
                items.some((e, i) => e !== state!.items[i]) ||
                thumbs.some((e, i) => e !== state!.thumbs[i]) ||
                items.length !== state.items.length ||
                thumbs.length !== state.thumbs.length;
            if (!state) {
                state = { items: [], thumbs: [], mask: '' };
                this.states.set(root, state);
            }
            if (changed) {
                for (const item of state.items) item.removeAttribute(PAGE);
                for (const thumb of state.thumbs) thumb.removeAttribute(SKIP);
                if (root.matches('.paging_capsules'))
                    items.forEach((item, i) => {
                        if (mask[i] === '1') item.setAttribute(PAGE, '');
                    });
                thumbs.forEach((thumb, i) => {
                    if (mask[i] === '1') thumb.setAttribute(SKIP, '');
                    else thumb.removeAttribute(SKIP);
                });
                state.items = items;
                state.thumbs = thumbs;
                state.mask = mask;
                state.attemptedFocus = undefined;
            }
            const empty = mask.split('').every((bit) => bit === '1');
            if (empty) {
                root.setAttribute('data-aif-carousel-empty', '');
                continue;
            }
            root.removeAttribute('data-aif-carousel-empty');
            const native = (
                this.doc.defaultView as unknown as {
                    GHomepage?: { MainCapCarousel?: NativeCarousel };
                }
            )?.GHomepage?.MainCapCarousel;
            const matchingNative =
                typeof native?.Advance === 'function' &&
                (native?.$elContainer?.[0] === root || native?.$elContainer?.[0]?.contains(root));
            const blockedFocus = items.find(
                (e, i) => e.classList.contains('focus') && mask[i] === '1',
            );
            if (blockedFocus && state.attemptedFocus !== blockedFocus) {
                // Do not repeatedly dispatch clicks if Steam's handler is absent
                // or has changed. Optional page helpers must not break filtering.
                state.attemptedFocus = blockedFocus;
                if (matchingNative && this.tryCall(native, 'Advance')) continue;
                else root.querySelector<HTMLElement>('.arrow.right')?.click();
            } else if (!blockedFocus) {
                state.attemptedFocus = undefined;
                if (changed && matchingNative) {
                    this.tryCall(native, 'UpdateNearbyItems');
                    this.tryCall(native, 'UpdateControls');
                }
            }
        }
    }
    private restore(root: HTMLElement, state: State): void {
        for (const item of state.items) item.removeAttribute(PAGE);
        for (const thumb of state.thumbs) thumb.removeAttribute(SKIP);
        root.removeAttribute('data-aif-carousel-empty');
        const native = (
            this.doc.defaultView as unknown as { GHomepage?: { MainCapCarousel?: NativeCarousel } }
        )?.GHomepage?.MainCapCarousel;
        if (
            root.isConnected &&
            (native?.$elContainer?.[0] === root || native?.$elContainer?.[0]?.contains(root))
        ) {
            this.tryCall(native, 'UpdateNearbyItems');
            this.tryCall(native, 'UpdateControls');
        }
    }
    private tryCall(
        native: NativeCarousel | undefined,
        method: keyof Omit<NativeCarousel, '$elContainer'>,
    ): boolean {
        try {
            const action = native?.[method];
            if (typeof action === 'function') {
                action.call(native);
                return true;
            }
        } catch {
            /* Isolated preloads and Steam updates can invalidate helpers. */
        }
        return false;
    }
    stop(): void {
        for (const [root, state] of this.states) this.restore(root, state);
        this.states.clear();
        this.style.remove();
    }
}
