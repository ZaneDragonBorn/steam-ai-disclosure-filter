import { appIdFromURL } from '../steam/provider';

const HIDDEN = 'data-ai-disclosure-filter-hidden';
const SKIP = 'data-aif-carousel-skip';
interface State {
    dots: HTMLElement[];
    attempt?: string;
}
/** Observed pure-react-carousel markup on Steam's homepage (Oct 2026).
 * Its tray uses percentage widths and indexed transforms: never remove/reorder
 * slides. Skip a fully blocked page through an existing dot's React handler. */
export class ReactCarouselPresentation {
    private states = new Map<HTMLElement, State>();
    constructor(private readonly doc: Document) {}
    update(): void {
        const roots = [...this.doc.querySelectorAll<HTMLElement>('.carousel')];
        for (const [root, state] of this.states)
            if (!roots.includes(root)) {
                this.restore(root, state);
                this.states.delete(root);
            }
        for (const root of roots) {
            const owned = (selector: string) =>
                [...root.querySelectorAll<HTMLElement>(selector)].filter(
                    (e) => e.closest('.carousel') === root,
                );
            const slides = owned('.carousel__slide'),
                dots = owned('.carousel__dot');
            if (!slides.length || slides.length !== dots.length) {
                const state = this.states.get(root);
                if (state) {
                    this.restore(root, state);
                    this.states.delete(root);
                }
                continue;
            }
            const mask = slides
                .map((slide) => {
                    const links = [...slide.querySelectorAll<HTMLAnchorElement>('a[href]')];
                    return links.some((a) => appIdFromURL(a.href) !== null) &&
                        links.every((a) => !!a.closest(`[${HIDDEN}]`))
                        ? '1'
                        : '0';
                })
                .join('');
            let state = this.states.get(root);
            if (!state) {
                state = { dots: [] };
                this.states.set(root, state);
            }
            for (const dot of state.dots) if (!dots.includes(dot)) dot.removeAttribute(SKIP);
            dots.forEach((dot, i) => {
                if (mask[i] === '1') dot.setAttribute(SKIP, '');
                else dot.removeAttribute(SKIP);
            });
            state.dots = dots;
            if (!mask.includes('0')) {
                root.setAttribute('data-aif-carousel-empty', '');
                continue;
            }
            root.removeAttribute('data-aif-carousel-empty');
            const selected = dots.findIndex((dot) =>
                dot.classList.contains('carousel__dot--selected'),
            );
            if (selected < 0 || mask[selected] !== '1') {
                state.attempt = undefined;
                continue;
            }
            const signature = `${selected}:${mask}`;
            if (state.attempt === signature) continue;
            state.attempt = signature;
            for (let distance = 1; distance < slides.length; distance++) {
                const index = (selected + distance) % slides.length;
                if (mask[index] === '0') {
                    dots[index].click();
                    break;
                }
            }
        }
    }
    private restore(root: HTMLElement, state: State): void {
        for (const dot of state.dots) dot.removeAttribute(SKIP);
        root.removeAttribute('data-aif-carousel-empty');
    }
    stop(): void {
        for (const [root, state] of this.states) this.restore(root, state);
        this.states.clear();
    }
}
