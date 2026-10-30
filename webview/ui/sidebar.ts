import { Settings, availablePresets, presetDescription, shouldHide } from '../../shared/settings';
import type { ReviewedApp } from '../../shared/history';
import { rankApps } from '../../shared/history';
import { filterHosts, categoryFilterGroup } from '../steam/surfaces';

const css = `
[data-aif-panel]{box-sizing:border-box;margin:0 0 12px;padding:0;color:inherit;background:transparent;border:0;font:inherit;font-size:12px;line-height:1.5;min-width:0}
[data-aif-panel] *{box-sizing:border-box}
[data-aif-panel] [hidden]{display:none!important}
[data-aif-panel] button.aif-header{display:flex;align-items:center;gap:8px;width:100%;margin:0 0 8px;padding:0;min-height:24px;border:0;border-radius:0;background:transparent;color:#c6d4df;cursor:pointer;user-select:none;-webkit-user-select:none;text-align:left}
[data-aif-panel] .aif-header *{cursor:pointer;user-select:none;-webkit-user-select:none}
[data-aif-panel] .aif-heading{flex:1;font:inherit;font-size:13px;font-weight:600;color:inherit;margin:0;text-transform:uppercase;letter-spacing:0}
[data-aif-panel] .aif-collapse{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;padding:0;margin:0;background:transparent;color:inherit;text-align:left;font:inherit;font-size:16px;font-weight:500;text-transform:uppercase}
[data-aif-panel] .aif-chevron{height:10px;width:10%;fill:rgba(255,255,255,.75);transform:rotate(0deg);flex-shrink:0}
[data-aif-panel] .aif-collapse[aria-expanded=false] .aif-chevron{transform:rotate(-90deg)}
[data-aif-panel] .aif-dot{flex:none;display:inline-block;width:9px;height:9px;border-radius:50%;background:#d8ad64;box-shadow:0 0 0 2px rgba(0,0,0,.12);cursor:pointer;margin:0 2px}
[data-aif-panel] .aif-dot[data-state=complete]{background:#a4d007}
[data-aif-panel] .aif-dot[data-state=unavailable]{background:#d8ad64}
#additional_search_options [data-aif-panel]{border:1px solid rgba(255,255,255,.1);color:#9fbbcb;padding:0 12px 10px}
#additional_search_options [data-aif-panel] button.aif-header{width:calc(100% + 24px);background:#323e4c;margin:0 -12px 14px;padding:3px 5px}
#additional_search_options [data-aif-panel] .aif-heading{font-size:12px;font-weight:normal;text-transform:none;color:#c6d4df}
[data-aif-panel] input[type=range]{display:block;width:100%;height:4px;appearance:none;background:linear-gradient(to right,#67c1f5 0%,#67c1f5 var(--aif-fill,0%),#4c6b82 var(--aif-fill,0%),#4c6b82 100%);border:0;border-radius:2px;margin:18px 0 14px;cursor:pointer}
[data-aif-panel] input[type=range]::-webkit-slider-thumb{appearance:none;width:14px;height:14px;border-radius:50%;background:#fff;box-shadow:0 1px 5px #000}
[data-aif-panel] .aif-current{text-align:center;font-size:14px;font-weight:500;color:#c6d4df;margin:8px 0 10px}
[data-aif-panel] p{margin:6px 0;font-size:12px;color:inherit}
[data-aif-panel] textarea,[data-aif-panel] input[type=search]{display:block;width:100%;margin:8px 0;padding:6px;background:rgba(0,0,0,.25);color:inherit;border:1px solid rgba(255,255,255,.15);border-radius:2px;font:inherit}
[data-aif-panel] textarea{min-height:65px;resize:vertical}
[data-aif-panel] button{padding:4px 7px;margin:4px 4px 4px 0;border:0;border-radius:2px;color:#c6d4df;background:rgba(103,193,245,.15);font:inherit;font-size:11px;cursor:pointer}
[data-aif-panel] button:hover{color:#fff;background:rgba(103,193,245,.3)}
[data-aif-panel] .aif-collapse:hover{background:transparent}
[data-aif-panel][data-surface=category] .aif-header{color:#fff}
[data-aif-panel][data-surface=category] .aif-heading{color:#fff;opacity:.7;padding:4px 0}
[data-aif-panel][data-surface=category] .aif-header:hover .aif-heading{opacity:.85}
#additional_search_options [data-aif-panel].collapsed{padding-bottom:0}
#additional_search_options [data-aif-panel].collapsed .aif-header{margin-bottom:0}
[data-aif-panel] button:focus-visible,[data-aif-panel] input:focus-visible,[data-aif-panel] textarea:focus-visible,[data-aif-panel] summary:focus-visible,[data-aif-panel] .aif-dot:focus-visible{outline:2px solid #67c1f5;outline-offset:3px}
[data-aif-panel] .aif-disclosures{border:0;padding:0;margin-top:8px}
[data-aif-panel] summary{cursor:pointer;font-size:12px;padding:6px 0}
[data-aif-panel] .aif-review{max-height:320px;overflow:auto}
[data-aif-panel] article{border-top:1px solid rgba(255,255,255,.12);padding:8px 0;overflow-wrap:anywhere}
[data-aif-panel] blockquote{margin:6px 0;white-space:pre-wrap;font-size:11px;max-height:150px;overflow:auto}
[data-aif-panel] a{color:#67c1f5}
[data-aif-panel] h4{font:inherit;font-weight:600;margin:0 0 6px}
#additional_search_options [data-aif-panel] .aif-collapse{font-size:12px;font-weight:400;text-transform:none}
[data-aif-panel][data-surface=category] .aif-heading{font-size:16px;font-weight:500}
[data-aif-panel][data-surface=category]{margin-bottom:8px}
[data-aif-panel][data-surface=category] button.aif-header{align-items:normal;gap:0;min-height:0;margin-bottom:4px}
[data-aif-panel][data-surface=category] .aif-chevron{margin:10px 0 0}
[data-aif-panel] .aif-slider-row{display:flex;align-items:center;gap:10px}
[data-aif-panel] .aif-slider-row input{flex:1;min-width:0}
[data-aif-panel] .aif-refresh{flex:none;margin:4px 0 0;padding:2px 5px;background:transparent;font-size:16px;line-height:20px}
[data-aif-panel][data-surface=category] .aif-category-status{display:inline-block;font-size:11px;margin:4px 0 8px;padding:3px 7px;border:1px solid #528274;border-radius:12px;background:rgba(79,154,123,.15);color:#b4e3cb}
[data-aif-panel] .aif-category-status[data-state=checking]{color:#8ed1fa;border-color:#4c6b82;background:rgba(103,193,245,.1)}
[data-aif-panel] .aif-category-status[data-state=unavailable]{color:#e5c28b;border-color:#8b7554}
[data-aif-panel] .aif-disclosures>summary{font-size:12px;font-weight:500;line-height:1.4}
[data-aif-panel] summary .aif-info{display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;margin:0 0 0 5px;padding:0;width:16px;height:16px;border:1px solid currentColor;border-radius:50%;background:transparent;font:11px/1 Arial,sans-serif}
[data-aif-panel] .aif-management-info{padding:6px;border:1px solid #4c6b82;background:rgba(103,193,245,.08)}
[data-aif-panel] .aif-error:empty{display:none}
[data-aif-panel] .aif-error{color:#ffbca9}
[data-aif-panel] .aif-exceptions-section{border-top:1px solid rgba(255,255,255,.15);margin-top:12px;padding-top:8px}
[data-aif-panel] .aif-exceptions{display:flex;flex-wrap:wrap;gap:6px;max-height:160px;overflow:auto}
[data-aif-panel] .aif-exception-chip{display:inline-flex;align-items:center;gap:5px;padding:3px 5px 3px 7px;background:rgba(103,193,245,.15);border-radius:2px;max-width:100%}
[data-aif-panel] .aif-exception-chip span{overflow-wrap:anywhere}
[data-aif-panel] .aif-exception-chip button{flex-shrink:0;margin:0;padding:0 3px;background:transparent;font-size:16px;line-height:18px}
[data-aif-search-summary]{box-sizing:border-box;padding:9px 10px;margin:0 0 5px;background:rgba(103,193,245,.08);border-left:2px solid #67c1f5;color:#b6d7e8;font-size:12px;line-height:1.4}
`;

export class SidebarUI {
    private panels = new Map<HTMLElement, HTMLElement>();
    private observer: MutationObserver;
    private style: HTMLStyleElement;
    private settings: Settings = { mode: 'off', debug: false };
    private apps: ReviewedApp[] = [];
    private savedApps: ReviewedApp[] = [];
    private searchSummary?: HTMLElement;
    private hidden = 0;
    private checking = false;
    private unresolved = 0;
    private reviewSignature = '';
    private query = '';
    private expanded = true;
    private serial = 0;
    private timer?: ReturnType<typeof setTimeout>;
    private stopped = false;
    constructor(
        private readonly doc: Document,
        private readonly save: (patch: Partial<Settings>) => Promise<void>,
        private readonly findHosts: (doc: Document) => HTMLElement[] = filterHosts,
        private readonly refresh: () => void = () => {},
    ) {
        this.style = doc.createElement('style');
        this.style.textContent = css;
        doc.head.append(this.style);
        this.observer = new MutationObserver((records) => {
            if (
                records.every((r) =>
                    (r.target as Element).closest?.('[data-aif-panel],[data-aif-search-summary]'),
                )
            )
                return;
            if (!this.timer)
                this.timer = setTimeout(() => {
                    this.timer = undefined;
                    this.mount();
                }, 100);
        });
        this.observer.observe(doc.documentElement, { childList: true, subtree: true });
        this.mount();
    }
    private node<K extends keyof HTMLElementTagNameMap>(
        tag: K,
        text?: string,
    ): HTMLElementTagNameMap[K] {
        const e = this.doc.createElement(tag);
        if (text !== undefined) e.textContent = text;
        return e;
    }
    private button(text: string, action: () => void): HTMLButtonElement {
        const e = this.node('button', text);
        e.type = 'button';
        e.addEventListener('click', action);
        return e;
    }
    private commit(patch: Partial<Settings>): void {
        for (const panel of this.panels.values())
            panel.querySelector('.aif-error')!.textContent = 'Saving…';
        void this.save(patch)
            .then(() => {
                for (const panel of this.panels.values())
                    panel.querySelector('.aif-error')!.textContent = '';
            })
            .catch(() => {
                this.update(this.settings);
                for (const panel of this.panels.values())
                    panel.querySelector('.aif-error')!.textContent =
                        'Could not save. Check that the plugin is enabled, then retry.';
            });
    }
    mount(): void {
        if (this.stopped) return;
        const hosts = this.findHosts(this.doc);
        this.renderSummary(hosts.some((host) => host.id === 'additional_search_options'));
        for (const [host, panel] of this.panels)
            if (!hosts.includes(host) || !host.contains(panel)) {
                panel.remove();
                this.panels.delete(host);
            }
        for (const host of hosts)
            if (!this.panels.has(host)) {
                const panel = this.node('section');
                panel.setAttribute('data-aif-panel', '');
                panel.setAttribute('aria-label', 'Generative AI filter');
                const header = this.button('', () => {
                    this.expanded = !this.expanded;
                    for (const p of this.panels.values()) {
                        this.setExpanded(p, true);
                        this.renderSettings(p);
                    }
                });
                header.className = 'aif-header aif-collapse';
                const body = this.node('div');
                body.className = 'aif-body';
                body.id = `aif-body-${++this.serial}`;
                const heading = this.node('span', 'Generative AI');
                heading.className = 'aif-heading';
                const searchPage = host.id === 'additional_search_options';
                panel.dataset.surface = searchPage ? 'search' : 'category';
                header.setAttribute('aria-controls', body.id);
                header.append(heading);
                if (searchPage) {
                    const dot = this.node('span');
                    dot.className = 'aif-dot';
                    header.append(dot);
                } else {
                    // Native sale headers use 70% title opacity and this SVG, not a
                    // text glyph. Reuse their CSS classes for the same hover treatment.
                    const native = categoryFilterGroup(host);
                    if (native) {
                        header.classList.add(...native.header.classList);
                        heading.classList.add(...native.heading.classList);
                    }
                    const ns = 'http://www.w3.org/2000/svg';
                    const chevron = this.doc.createElementNS(ns, 'svg');
                    chevron.setAttribute('class', 'aif-chevron');
                    chevron.setAttribute('viewBox', '0 0 24.833 21.917');
                    chevron.setAttribute('aria-hidden', 'true');
                    const polygon = this.doc.createElementNS(ns, 'polygon');
                    polygon.setAttribute(
                        'points',
                        '12.5,14.873 3.302,5.723 1.185,7.848 12.5,19.103 23.814,7.848 21.697,5.723',
                    );
                    chevron.append(polygon);
                    header.append(chevron);
                }
                panel.append(header, body);
                if (searchPage) {
                    panel.classList.add('block', 'aif-search-block');
                    header.classList.add('block_header', 'labs_block_header');
                    const native = host.querySelector<HTMLElement>(
                        '.search_collapse_block .block_header',
                    );
                    const nativeStyle = native && this.doc.defaultView?.getComputedStyle(native);
                    if (nativeStyle) {
                        header.style.backgroundColor = nativeStyle.backgroundColor;
                        heading.style.color = nativeStyle.color;
                        heading.style.fontSize = nativeStyle.fontSize;
                        heading.style.fontWeight = nativeStyle.fontWeight;
                    }
                } else {
                    const status = this.node('p');
                    status.className = 'aif-category-status';
                    status.setAttribute('aria-live', 'polite');
                    body.append(status);
                }
                const slider = this.node('input');
                slider.type = 'range';
                slider.min = '0';
                slider.max = String(availablePresets(this.settings).length - 1);
                slider.step = '1';
                slider.setAttribute('aria-label', 'Generative AI visibility');
                const select = () => {
                    const index = Number(slider.value);
                    this.renderPreset(panel, index);
                    const preset = availablePresets(this.settings)[index];
                    if (preset && preset.mode !== this.settings.mode)
                        this.commit({ mode: preset.mode });
                };
                slider.addEventListener('input', select);
                slider.addEventListener('change', select);
                const sliderRow = this.node('div');
                sliderRow.className = 'aif-slider-row';
                const refresh = this.button('↻', () => this.refresh());
                refresh.className = 'aif-refresh';
                refresh.title = 'Refresh filters';
                refresh.setAttribute('aria-label', 'Refresh filters');
                sliderRow.append(slider, refresh);
                body.append(sliderRow);
                const current = this.node('div');
                current.className = 'aif-current';
                body.append(current);
                const description = this.node('p');
                description.className = 'aif-description';
                body.append(description);
                const custom = this.node('div');
                custom.className = 'aif-custom';
                const label = this.node('label', 'Disclosure phrases to block');
                const phrases = this.node('textarea');
                phrases.setAttribute('aria-label', 'Disclosure phrases to block');
                phrases.placeholder = 'One phrase per line';
                label.append(phrases);
                custom.append(label);
                custom.append(
                    this.node('p', 'Enter one phrase per line. Matches ignore capitalization.'),
                );
                custom.append(
                    this.button('Apply phrases', () =>
                        this.commit({
                            phrases: phrases.value
                                .split('\n')
                                .map((p) => p.trim())
                                .filter(Boolean),
                        }),
                    ),
                );
                body.append(custom);
                const review = this.node('details');
                review.className = 'aif-disclosures';
                const summary = this.node('summary', 'Review disclosures & exceptions');
                const info = this.node(
                    'p',
                    'Open Steam → Millennium Library Manager → AI Disclosure Filter to add exceptions by Steam App ID or manage existing exemptions.',
                );
                info.className = 'aif-management-info';
                info.hidden = true;
                const infoButton = this.button('i', () => {});
                infoButton.className = 'aif-info';
                infoButton.setAttribute('aria-label', 'About managing exceptions');
                infoButton.setAttribute('aria-expanded', 'false');
                infoButton.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    info.hidden = !info.hidden;
                    infoButton.setAttribute('aria-expanded', String(!info.hidden));
                    if (!info.hidden) review.open = true;
                });
                summary.append(infoButton);
                review.append(summary, info, this.node('h4', 'Blocked titles'));
                const search = this.node('input');
                search.type = 'search';
                search.placeholder = 'Search blocked titles';
                search.setAttribute('aria-label', 'Search blocked titles');
                search.value = this.query;
                search.addEventListener('input', () => {
                    this.query = search.value;
                    for (const p of this.panels.values()) {
                        const input = p.querySelector<HTMLInputElement>('input[type=search]')!;
                        if (input !== search) input.value = this.query;
                        this.renderReview(p);
                    }
                });
                review.append(search);
                const list = this.node('div');
                list.className = 'aif-review';
                review.append(list);
                const exceptions = this.node('section');
                exceptions.className = 'aif-exceptions-section';
                exceptions.append(this.node('h4', 'Exceptions'));
                const chips = this.node('div');
                chips.className = 'aif-exceptions';
                exceptions.append(chips);
                review.append(exceptions);
                body.append(review);
                const error = this.node('p');
                error.className = 'aif-error';
                error.setAttribute('role', 'status');
                body.append(error);
                const nativeGroup = !searchPage ? categoryFilterGroup(host)?.group : null;
                if (nativeGroup?.parentElement)
                    nativeGroup.parentElement.insertBefore(panel, nativeGroup);
                else host.prepend(panel);
                this.panels.set(host, panel);
                this.renderSettings(panel);
                this.renderReview(panel);
            }
    }
    update(settings: Settings): void {
        this.settings = settings;
        this.mount();
        for (const panel of this.panels.values()) {
            this.renderSettings(panel);
            this.renderReview(panel);
        }
    }
    history(apps: ReviewedApp[]): void {
        this.savedApps = apps;
        for (const panel of this.panels.values()) this.renderExceptions(panel);
    }
    private renderSummary(searchPage: boolean): void {
        // Observed persistent warning survives Steam's AJAX search refreshes.
        // Keep a separate sibling; never subtract loaded cards from global totals.
        const anchor = searchPage
            ? this.doc.querySelector('#search_results_filtered_warning_persistent')
            : null;
        if (!anchor) {
            this.searchSummary?.remove();
            this.searchSummary = undefined;
            return;
        }
        if (!this.searchSummary) {
            this.searchSummary = this.node('div');
            this.searchSummary.setAttribute('data-aif-search-summary', '');
            this.searchSummary.setAttribute('role', 'status');
        }
        if (anchor.nextElementSibling !== this.searchSummary) anchor.after(this.searchSummary);
        const text = `Generative AI filter: ${this.hidden} additional cards hidden in the loaded results.`;
        if (this.searchSummary.textContent !== text) this.searchSummary.textContent = text;
    }
    private renderPreset(panel: HTMLElement, index: number): void {
        const presets = availablePresets(this.settings);
        const preset = presets[index];
        if (!preset) return;
        panel
            .querySelector<HTMLInputElement>('input[type=range]')!
            .style.setProperty('--aif-fill', `${(index / Math.max(1, presets.length - 1)) * 100}%`);
        const current = panel.querySelector('.aif-current')!;
        if (current.textContent !== preset.label) current.textContent = preset.label;
        const descriptionText =
            preset.mode === 'custom'
                ? "Block games whose AI disclosure contains any of the below phrases. Create custom filters in the plugin's settings menu!"
                : presetDescription(preset.mode);
        const description = panel.querySelector('.aif-description')!;
        if (description.textContent !== descriptionText) description.textContent = descriptionText;
        panel.querySelector<HTMLElement>('.aif-custom')!.hidden = preset.mode !== 'custom';
    }
    private renderSettings(panel: HTMLElement): void {
        const presets = availablePresets(this.settings);
        const index = presets.findIndex((p) => p.mode === this.settings.mode);
        const slider = panel.querySelector<HTMLInputElement>('input[type=range]')!;
        slider.max = String(presets.length - 1);
        slider.value = String(index);
        slider.setAttribute('aria-valuetext', presets[index].label);
        this.renderPreset(panel, index);
        const state = this.checking ? 'checking' : this.unresolved ? 'unavailable' : 'complete';
        const status = `${this.checking ? 'Checking' : this.unresolved ? `Not complete — ${this.unresolved} unavailable; retrying automatically` : 'Completed'} — ${this.hidden} cards hidden`;
        const dot = panel.querySelector<HTMLElement>('.aif-dot');
        if (dot) {
            dot.dataset.state = state;
            dot.title = status;
        }
        panel
            .querySelector('.aif-header')!
            .setAttribute(
                'aria-label',
                `Generative AI. ${status}. Click to ${this.expanded ? 'collapse' : 'expand'}.`,
            );
        const categoryStatus = panel.querySelector('.aif-category-status');
        if (categoryStatus) {
            (categoryStatus as HTMLElement).dataset.state = state;
            if (categoryStatus.textContent !== status) categoryStatus.textContent = status;
        }
        const collapse = panel.querySelector<HTMLButtonElement>('.aif-collapse');
        if (collapse) {
            collapse.setAttribute('aria-expanded', String(this.expanded));
            if (!panel.querySelector<HTMLElement>('.aif-body')!.dataset.expanded)
                this.setExpanded(panel, false);
        }
        const phrases = panel.querySelector('textarea')!;
        if (this.doc.activeElement !== phrases)
            phrases.value = (this.settings.phrases ?? []).join('\n');
    }
    review(
        apps: ReviewedApp[],
        hidden: number,
        _checked: number,
        checking = false,
        unresolved = 0,
    ): void {
        const signature = JSON.stringify([apps, hidden, checking, unresolved]);
        if (signature === this.reviewSignature) return;
        this.reviewSignature = signature;
        this.apps = apps;
        this.hidden = hidden;
        this.checking = checking;
        this.unresolved = unresolved;
        this.renderSummary(
            this.findHosts(this.doc).some((host) => host.id === 'additional_search_options'),
        );
        for (const panel of this.panels.values()) {
            this.renderSettings(panel);
            this.renderReview(panel);
        }
    }
    private renderReview(panel: HTMLElement): void {
        const all = rankApps(
            this.apps.filter((app) => shouldHide(this.settings, app.appId, true, app.notes)),
        );
        const query = this.query.trim().toLocaleLowerCase();
        const matches = all.filter((app) => app.title.toLocaleLowerCase().includes(query));
        const list = panel.querySelector('.aif-review')!;
        list.replaceChildren();
        if (!matches.length)
            list.append(
                this.node(
                    'p',
                    query
                        ? 'No blocked titles match your search.'
                        : 'No titles are currently blocked.',
                ),
            );
        for (const app of matches.slice(0, 40)) {
            const row = this.node('article');
            const link = this.node('a', app.title);
            link.href = `https://store.steampowered.com/app/${app.appId}/`;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            row.append(
                link,
                this.node(
                    'blockquote',
                    app.notes || 'Steam disclosure found; disclosure text unavailable.',
                ),
            );
            const allowed = this.settings.allowedApps?.includes(app.appId);
            row.append(
                this.button(allowed ? 'Remove exception' : 'Always show', () =>
                    this.commit({
                        allowedApps: allowed
                            ? (this.settings.allowedApps ?? []).filter((id) => id !== app.appId)
                            : [...(this.settings.allowedApps ?? []), app.appId],
                    }),
                ),
            );
            list.append(row);
        }
        if (matches.length > 40)
            list.append(
                this.node(
                    'p',
                    `Showing 40 of ${matches.length} blocked titles. Search to narrow the list.`,
                ),
            );
        this.renderExceptions(panel);
    }
    private renderExceptions(panel: HTMLElement): void {
        const list = panel.querySelector('.aif-exceptions')!;
        list.replaceChildren();
        const names = new Map(
            [...this.savedApps, ...this.apps].map((app) => [app.appId, app.title]),
        );
        if (!this.settings.allowedApps?.length) list.append(this.node('p', 'No exceptions yet.'));
        for (const id of this.settings.allowedApps ?? []) {
            const title = names.get(id) ?? `App ${id}`;
            const chip = this.node('span');
            chip.className = 'aif-exception-chip';
            chip.append(this.node('span', title));
            const remove = this.button('×', () =>
                this.commit({
                    allowedApps: (this.settings.allowedApps ?? []).filter((appId) => appId !== id),
                }),
            );
            remove.setAttribute('aria-label', `Remove exception for ${title}`);
            remove.title = `Remove exception for ${title}`;
            chip.append(remove);
            list.append(chip);
        }
    }
    private setExpanded(panel: HTMLElement, animate: boolean): void {
        const body = panel.querySelector<HTMLElement>('.aif-body')!;
        body.dataset.expanded = String(this.expanded);
        panel.classList.toggle('collapsed', !this.expanded);
        const jq = (
            this.doc.defaultView as unknown as {
                $J?: (node: HTMLElement) => {
                    stop: (clear: boolean, finish: boolean) => unknown;
                    slideUp: (speed: string, done: () => void) => unknown;
                    slideDown: (speed: string) => unknown;
                };
            }
        )?.$J;
        if (animate && jq && panel.dataset.surface === 'search') {
            const wrapped = jq(body);
            wrapped.stop(true, true);
            body.hidden = false;
            if (this.expanded) wrapped.slideDown('fast');
            else
                wrapped.slideUp('fast', () => {
                    if (!this.expanded) body.hidden = true;
                });
        } else if (animate && typeof body.animate === 'function') {
            const opening = this.expanded;
            body.hidden = false;
            body.style.removeProperty('display');
            const height = body.scrollHeight;
            const animation = body.animate(
                [
                    { height: opening ? '0px' : height + 'px', opacity: opening ? 0 : 1 },
                    { height: opening ? height + 'px' : '0px', opacity: opening ? 1 : 0 },
                ],
                { duration: 200, easing: 'ease-in-out' },
            );
            body.style.overflow = 'hidden';
            animation.onfinish = () => {
                body.hidden = !this.expanded;
                body.style.removeProperty('overflow');
            };
        } else {
            body.hidden = !this.expanded;
            if (this.expanded) body.style.removeProperty('display');
        }
    }
    stop(): void {
        this.stopped = true;
        clearTimeout(this.timer);
        this.observer.disconnect();
        for (const panel of this.panels.values()) panel.remove();
        this.panels.clear();
        this.searchSummary?.remove();
        this.style.remove();
    }
}
