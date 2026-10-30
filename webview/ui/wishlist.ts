import {
    availablePresets,
    normalizeSettings,
    presetDescription,
    Settings,
    FilterMode,
} from '../../shared/settings';
import { wishlistOptions, wishlistActiveFilters, WISHLIST_FILTER_CHIP } from '../steam/wishlist';

/** Additive native-form controls; Steam retains its filters, tags and handlers. */
export class WishlistUI {
    private sections = new Map<HTMLFormElement, HTMLElement>();
    private settings: Settings = normalizeSettings({});
    private observer: MutationObserver;
    private chip?: HTMLButtonElement;
    private serial = 0;
    private stopped = false;
    constructor(
        private readonly doc: Document,
        private readonly save: (patch: Partial<Settings>) => Promise<void>,
    ) {
        this.observer = new MutationObserver((records) => {
            if (
                records.every((record) =>
                    (record.target as Element).closest?.(
                        '[data-aif-wishlist-options],[data-aif-wishlist-active]',
                    ),
                )
            )
                return;
            this.mount();
        });
        this.observer.observe(doc.documentElement, { childList: true, subtree: true });
    }
    update(settings: Settings): void {
        this.settings = settings;
        this.mount();
    }
    private choose(mode: FilterMode): void {
        if (mode === (this.settings.wishlistMode ?? 'off')) return;
        void this.save({ wishlistMode: mode }).catch(() => {
            if (this.stopped) return;
            this.mount();
            for (const section of this.sections.values())
                section.querySelector('.aif-wishlist-error')!.textContent =
                    'Could not save. Please retry.';
        });
    }
    private mount(): void {
        if (this.stopped) return;
        this.renderActiveFilter();
        const forms = wishlistOptions(this.doc);
        for (const [form, section] of this.sections)
            if (!forms.includes(form) || !form.contains(section)) {
                section.remove();
                this.sections.delete(form);
            }
        for (const form of forms) {
            let section = this.sections.get(form);
            if (!section) {
                section = this.doc.createElement('section');
                section.className = form.querySelector('section')?.className ?? 'Focusable';
                section.setAttribute('data-aif-wishlist-options', '');
                section.style.cssText = 'min-width:0;align-self:start';
                const heading = this.doc.createElement('h3');
                heading.textContent = 'Generative AI Filter';
                const row = this.doc.createElement('div');
                row.style.cssText = 'display:flex;align-items:center;gap:8px';
                const slider = this.doc.createElement('input');
                slider.type = 'range';
                slider.min = '0';
                slider.step = '1';
                slider.className =
                    form.querySelector('input[type=range]')?.className ?? 'Focusable';
                slider.setAttribute('aria-label', 'Generative AI filter');
                slider.style.cssText = 'display:block;width:100%;min-width:0;accent-color:#1a9fff';
                const ticks = this.doc.createElement('datalist');
                ticks.id = `aif-wishlist-stops-${++this.serial}`;
                slider.setAttribute('list', ticks.id);
                const select = () => {
                    const index = Number(slider.value),
                        preset = availablePresets(this.settings)[index];
                    if (preset) {
                        this.renderSelection(section!, index);
                        this.choose(preset.mode);
                    }
                };
                slider.addEventListener('input', select);
                slider.addEventListener('change', select);
                row.append(slider, ticks);
                const current = this.doc.createElement('label');
                current.className =
                    form.querySelector('label[for^="priceFiltersRange"]')?.className ??
                    'qhUI2RnjHYw-';
                current.classList.add('aif-wishlist-current');
                current.style.overflowWrap = 'anywhere';
                slider.id = `${ticks.id}-slider`;
                current.htmlFor = slider.id;
                const error = this.doc.createElement('p');
                error.className = 'aif-wishlist-error';
                error.setAttribute('role', 'alert');
                error.style.cssText = 'font-size:12px;color:#ffbca9;margin:0';
                const nativeLabel = form.querySelector('input[name=viewmode]')?.parentElement;
                const color =
                    nativeLabel && this.doc.defaultView?.getComputedStyle(nativeLabel).color;
                if (color) {
                    row.style.color = color;
                    current.style.color = color;
                }
                section.append(heading, row, current, error);
                for (const name of ['click', 'input', 'change'])
                    section.addEventListener(name, (event) => event.stopPropagation());
                const platform = form.querySelector('input[name=platform]')?.closest('section');
                if (platform) form.insertBefore(section, platform);
                else form.append(section);
                this.sections.set(form, section);
            }
            const presets = availablePresets(this.settings),
                signature = JSON.stringify(presets);
            const ticks = section.querySelector('datalist')!,
                slider = section.querySelector<HTMLInputElement>('input[type=range]')!;
            if (section.dataset.presets !== signature) {
                ticks.replaceChildren();
                section.dataset.presets = signature;
                slider.max = String(presets.length - 1);
                presets.forEach((preset, index) => {
                    const tick = this.doc.createElement('option');
                    tick.value = String(index);
                    tick.label = preset.label;
                    ticks.append(tick);
                });
            }
            const index = Math.max(
                0,
                presets.findIndex((p) => p.mode === (this.settings.wishlistMode ?? 'off')),
            );
            slider.value = String(index);
            this.renderSelection(section, index);
        }
    }
    private renderSelection(section: HTMLElement, index: number): void {
        const preset = availablePresets(this.settings)[index];
        if (!preset) return;
        const slider = section.querySelector<HTMLInputElement>('input[type=range]')!;
        slider.setAttribute('aria-valuetext', preset.label);
        const current = section.querySelector('.aif-wishlist-current')!;
        if (current.textContent !== preset.label) current.textContent = preset.label;
        const description = presetDescription(preset.mode);
        slider.title = description;
        current.setAttribute('title', description);
        section.querySelector('.aif-wishlist-error')!.textContent = '';
    }
    private renderActiveFilter(): void {
        const preset = availablePresets(this.settings).find(
            (p) => p.mode === (this.settings.wishlistMode ?? 'off'),
        );
        const host = wishlistActiveFilters(this.doc);
        if (!preset || preset.mode === 'off' || !host) {
            this.chip?.remove();
            this.chip = undefined;
            return;
        }
        if (!this.chip) {
            this.chip = this.doc.createElement('button');
            this.chip.type = 'button';
            this.chip.className = WISHLIST_FILTER_CHIP;
            this.chip.setAttribute('data-aif-wishlist-active', '');
            this.chip.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.choose('off');
            });
        }
        const text = `Gen AI: ${preset.label}`;
        if (this.chip.textContent !== text) this.chip.textContent = text;
        this.chip.setAttribute('aria-label', `Remove ${text} filter`);
        this.chip.title = 'Remove Generative AI filter';
        if (this.chip.parentElement !== host) host.append(this.chip);
    }
    stop(): void {
        this.stopped = true;
        this.observer.disconnect();
        this.chip?.remove();
        for (const section of this.sections.values()) section.remove();
        this.sections.clear();
    }
}
