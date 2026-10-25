import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { normalizeSettings, shouldHide, Settings } from '../shared/settings';
import { detectStoreCards, filterHosts } from '../webview/steam/surfaces';
import { SidebarUI } from '../webview/ui/sidebar';
import { FilterController } from '../webview/filtering/controller';

const sale = `<div class="sale_item_browser"><aside class="_1tOSyFfIWM42bIEwzvMp8v"><h2>Filters</h2></aside><div class="LibraryAssetExpandedDisplay"><a href="/app/1808500/"><div class="HeroCapsuleImageContainer"><img alt="ARC Raiders"></div></a></div></div>`;
test('observed Search, VR, Trains and sale list structures have independent adapters', () => {
    for (const path of [
        '/vr',
        '/category/trains',
        '/tags/en/Souls-like/',
        '/sale/nextfest?tab=23',
    ]) {
        const dom = new JSDOM(sale, { url: 'https://store.steampowered.com' + path });
        assert.equal(filterHosts(dom.window.document).length, 1);
        assert.equal(detectStoreCards(dom.window.document)[0].appId, 1808500);
        dom.window.close();
    }
    const dom = new JSDOM(
        '<aside id="additional_search_options"></aside><div id="search_resultsRows"><a class="search_result_row" href="/app/620/">Portal 2</a><a class="search_result_row" href="/sub/620/">Package</a></div>',
        { url: 'https://store.steampowered.com/search?term=' },
    );
    assert.equal(filterHosts(dom.window.document).length, 1);
    assert.equal(detectStoreCards(dom.window.document).length, 1);
    dom.window.history.pushState({}, '', '/app/620/');
    assert.equal(filterHosts(dom.window.document).length, 0);
    assert.equal(detectStoreCards(dom.window.document).length, 0);
    dom.window.close();
});
test('custom rules match only authoritative disclosure text and respect exceptions', () => {
    const settings = normalizeSettings({
        mode: 'custom',
        phrases: ['artwork'],
        allowedApps: [1808500],
    });
    assert.equal(shouldHide(settings, 1, true, 'AI-generated artwork'), true);
    assert.equal(shouldHide(settings, 1, true, 'Assisted voice recording'), false);
    assert.equal(shouldHide(settings, 1, null, 'AI-generated artwork'), false);
    assert.equal(shouldHide(settings, 1808500, true, 'AI-generated artwork'), false);
    assert.equal(shouldHide({ ...settings, mode: 'hide' }, 1808500, true), false);
    assert.equal(shouldHide({ ...settings, mode: 'hide' }, 2, true), true);
    assert.equal(
        shouldHide(
            normalizeSettings({ ...settings, revealUntil: Date.now() + 5000 }),
            1,
            true,
            'artwork',
        ),
        true,
    );
    assert.deepEqual(
        normalizeSettings({
            allowedApps: [0, '1', -1, 620, 620],
            phrases: [null, '', ' art ', 'art'],
        }).allowedApps,
        [620],
    );
});
test('sidebar mounts once, saves slider/custom choices, survives replacement, and cleans up', async () => {
    const dom = new JSDOM(sale, { url: 'https://store.steampowered.com/vr' });
    const doc = dom.window.document;
    Object.assign(globalThis, { MutationObserver: dom.window.MutationObserver });
    let settings: Settings = normalizeSettings({});
    const writes: Partial<Settings>[] = [];
    const ui = new SidebarUI(doc, async (patch) => {
        writes.push(patch);
        settings = normalizeSettings({ ...settings, ...patch });
        ui.update(settings);
    });
    const tick = () => new Promise((resolve) => setTimeout(resolve, 150));
    try {
        ui.mount();
        ui.mount();
        assert.equal(doc.querySelectorAll('[data-aif-panel]').length, 1);
        assert.equal(
            doc.querySelector('aside')!.firstElementChild?.getAttribute('aria-label'),
            'Generative AI filter',
        );
        const slider = doc.querySelector<HTMLInputElement>('input[type=range]')!;
        slider.value = '2';
        slider.dispatchEvent(new dom.window.Event('change'));
        await tick();
        assert.equal(settings.mode, 'custom');
        assert.equal(doc.querySelector<HTMLElement>('.aif-custom')!.hidden, false);
        doc.querySelector('textarea')!.value = 'artwork\nvoices';
        [...doc.querySelectorAll('button')].find((e) => e.textContent === 'Apply phrases')!.click();
        await tick();
        assert.deepEqual(settings.phrases, ['artwork', 'voices']);
        ui.review(
            [
                {
                    appId: 1808500,
                    title: 'ARC Raiders',
                    notes: '<script>bad()</script> AI artwork',
                    allowed: false,
                },
            ],
            1,
            1,
        );
        assert.equal(doc.querySelectorAll('script').length, 0);
        [...doc.querySelectorAll('button')].find((e) => e.textContent === 'Always show')!.click();
        await tick();
        assert.deepEqual(settings.allowedApps, [1808500]);
        doc.querySelector('aside')!.replaceWith(
            Object.assign(doc.createElement('aside'), { className: '_1tOSyFfIWM42bIEwzvMp8v' }),
        );
        await tick();
        assert.equal(doc.querySelectorAll('[data-aif-panel]').length, 1);
        ui.stop();
        assert.equal(doc.querySelectorAll('[data-aif-panel]').length, 0);
        assert.equal(writes.length, 3);
    } finally {
        ui.stop();
        dom.window.close();
    }
});
test('Search filtering consumes disclosure phrases and restores allowed titles', async () => {
    const dom = new JSDOM(
        '<div id="search_resultsRows"><a class="search_result_row" href="/app/1808500/"><span class="title">ARC Raiders</span></a></div>',
        { url: 'https://store.steampowered.com/search' },
    );
    Object.assign(globalThis, { MutationObserver: dom.window.MutationObserver });
    const controller = new FilterController(dom.window.document, {
        hasAIDisclosure: async () => true,
        getNotes: () => 'AI voices',
    });
    try {
        controller.update(normalizeSettings({ mode: 'custom', phrases: ['voices'] }));
        await new Promise((resolve) => setTimeout(resolve, 150));
        assert.equal(
            dom.window.document.querySelectorAll('[data-ai-disclosure-filter-hidden]').length,
            1,
        );
        controller.update(normalizeSettings({ mode: 'hide', allowedApps: [1808500] }));
        assert.equal(
            dom.window.document.querySelectorAll('[data-ai-disclosure-filter-hidden]').length,
            0,
        );
    } finally {
        controller.stop();
        dom.window.close();
    }
});

test('sidebar reports unavailable lookups instead of claiming completion', () => {
    const dom = new JSDOM('<aside id="additional_search_options"></aside>', {
        url: 'https://store.steampowered.com/search',
    });
    Object.assign(globalThis, { MutationObserver: dom.window.MutationObserver });
    const ui = new SidebarUI(dom.window.document, async () => {});
    try {
        ui.review([], 0, 1, false, 1);
        assert.match(
            dom.window.document.querySelector('.aif-dot')!.getAttribute('title')!,
            /unavailable/,
        );
        assert.doesNotMatch(
            dom.window.document.querySelector('.aif-current')!.textContent!,
            /Complete/,
        );
        ui.review([], 0, 1, false, 0);
        assert.match(
            dom.window.document.querySelector('.aif-dot')!.getAttribute('title')!,
            /^Completed/,
        );
    } finally {
        ui.stop();
        dom.window.close();
    }
});

test('header status, single preset, search beyond first 40, and collapse preserve settings', async () => {
    const dom = new JSDOM(sale, { url: 'https://store.steampowered.com/vr' });
    const doc = dom.window.document;
    Object.assign(globalThis, { MutationObserver: dom.window.MutationObserver });
    let settings = normalizeSettings({ mode: 'light' });
    let writes = 0;
    const ui = new SidebarUI(doc, async (patch) => {
        writes++;
        settings = normalizeSettings({ ...settings, ...patch });
        ui.update(settings);
    });
    try {
        ui.update(settings);
        assert.equal(doc.querySelector('.aif-current')!.textContent, 'Light Usage');
        assert.equal(doc.querySelectorAll('[data-mode]').length, 0);
        assert.match(
            doc
                .querySelector<HTMLInputElement>('input[type=range]')!
                .style.getPropertyValue('--aif-fill'),
            /33/,
        );
        ui.review([], 13, 100, false, 0);
        assert.equal(
            doc.querySelector('.aif-category-status')!.textContent,
            'Completed — 13 cards hidden',
        );
        assert.equal(doc.querySelector('.aif-dot'), null);
        assert.equal(doc.querySelectorAll('.aif-status').length, 0);
        ui.review(
            Array.from({ length: 55 }, (_, i) => ({
                appId: i + 1,
                title: i === 54 ? 'Needle Title' : 'Game ' + i,
                notes: 'AI artwork',
                allowed: false,
            })),
            13,
            100,
            false,
        );
        const search = doc.querySelector<HTMLInputElement>('input[type=search]')!;
        search.value = 'needle';
        search.dispatchEvent(new dom.window.Event('input'));
        assert.equal(doc.querySelectorAll('article').length, 1);
        assert.match(doc.querySelector('article')!.textContent!, /Needle Title/);
        const collapse = doc.querySelector<HTMLButtonElement>('.aif-collapse')!;
        collapse.click();
        assert.equal(collapse.getAttribute('aria-expanded'), 'false');
        assert.equal(doc.querySelector<HTMLElement>('.aif-body')!.hidden, true);
        ui.update(settings);
        assert.equal(doc.querySelector<HTMLElement>('.aif-body')!.hidden, true);
        assert.equal(settings.mode, 'light');
        assert.equal(writes, 0);
        collapse.click();
        [...doc.querySelectorAll('article button')]
            .find((b) => b.textContent === 'Always show')!
            .dispatchEvent(new dom.window.MouseEvent('click'));
        await new Promise((r) => setTimeout(r, 10));
        assert.deepEqual(settings.allowedApps, [55]);
    } finally {
        ui.stop();
        dom.window.close();
    }
});
