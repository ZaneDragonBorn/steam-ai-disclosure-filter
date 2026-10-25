import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { SidebarUI } from '../webview/ui/sidebar';
import { normalizeSettings } from '../shared/settings';

const search =
    '<aside id="additional_search_options"></aside><div id="search_results_filtered_warning_persistent"><div>1,000 results match. 10 excluded.</div><button>Steam preferences</button></div><div id="search_resultsRows"></div>';
test('search summary reports loaded-card count separately, survives AJAX replacement and cleans up', async () => {
    const dom = new JSDOM(search, { url: 'https://store.steampowered.com/search/' });
    const doc = dom.window.document;
    Object.assign(globalThis, { MutationObserver: dom.window.MutationObserver });
    const ui = new SidebarUI(doc, async () => {});
    try {
        const original = doc.querySelector(
            '#search_results_filtered_warning_persistent',
        )!.innerHTML;
        ui.review([], 13, 100, false);
        assert.equal(
            doc.querySelector('[data-aif-search-summary]')!.textContent,
            'Generative AI filter: 13 additional cards hidden in the loaded results.',
        );
        assert.equal(
            doc.querySelector('#search_results_filtered_warning_persistent')!.innerHTML,
            original,
        );
        assert.equal(
            doc.querySelector('#search_results_filtered_warning_persistent')!.nextElementSibling,
            doc.querySelector('[data-aif-search-summary]'),
        );
        ui.review([], 0, 100, false);
        assert.match(
            doc.querySelector('[data-aif-search-summary]')!.textContent!,
            /: 0 additional cards/,
        );
        const old = doc.querySelector('#search_results_filtered_warning_persistent')!;
        old.replaceWith(old.cloneNode(true));
        ui.mount();
        ui.mount();
        assert.equal(doc.querySelectorAll('[data-aif-search-summary]').length, 1);
        assert.equal(
            doc.querySelector('#search_results_filtered_warning_persistent')!.nextElementSibling,
            doc.querySelector('[data-aif-search-summary]'),
        );
        doc.querySelector('[data-aif-search-summary]')!.remove();
        ui.mount();
        assert.equal(doc.querySelectorAll('[data-aif-search-summary]').length, 1);
        doc.querySelector('#search_results_filtered_warning_persistent')!.remove();
        ui.mount();
        assert.equal(doc.querySelector('[data-aif-search-summary]'), null);
        ui.stop();
        assert.equal(doc.querySelector('[data-aif-search-summary]'), null);
    } finally {
        ui.stop();
        dom.window.close();
    }
});

test('persistent exception chips are independent of blocked-title search and remove only their own ID', async () => {
    const dom = new JSDOM(search, { url: 'https://store.steampowered.com/search/' });
    const doc = dom.window.document;
    Object.assign(globalThis, { MutationObserver: dom.window.MutationObserver });
    let settings = normalizeSettings({ mode: 'off', allowedApps: [1, 2] });
    const ui = new SidebarUI(doc, async (patch) => {
        settings = normalizeSettings({ ...settings, ...patch });
        ui.update(settings);
    });
    try {
        ui.update(settings);
        ui.history([{ appId: 1, title: 'Saved title', notes: 'AI audio', allowed: true }]);
        ui.review(
            [{ appId: 2, title: 'Current title', notes: 'AI artwork', allowed: true }],
            0,
            2,
            false,
        );
        assert.equal(doc.querySelectorAll('article').length, 0);
        assert.equal(doc.querySelectorAll('.aif-exception-chip').length, 2);
        assert.match(doc.querySelector('.aif-exceptions-section h4')!.textContent!, /^Exceptions$/);
        const query = doc.querySelector<HTMLInputElement>('input[type=search]')!;
        query.value = 'unrelated';
        query.dispatchEvent(new dom.window.Event('input'));
        assert.equal(doc.querySelectorAll('.aif-exception-chip').length, 2);
        const button = doc.querySelector<HTMLButtonElement>(
            '[aria-label="Remove exception for Saved title"]',
        )!;
        assert.equal(button.textContent, '×');
        button.click();
        await new Promise((r) => setTimeout(r, 0));
        assert.deepEqual(settings.allowedApps, [2]);
        assert.equal(doc.querySelectorAll('.aif-exception-chip').length, 1);
        ui.update(normalizeSettings({ ...settings, mode: 'hide', allowedApps: [] }));
        query.value = '';
        query.dispatchEvent(new dom.window.Event('input'));
        assert.equal(doc.querySelectorAll('article').length, 1);
        assert.match(doc.querySelector('.aif-exceptions')!.textContent!, /No exceptions yet/);
    } finally {
        ui.stop();
        dom.window.close();
    }
});

test('category header uses the observed native header classes and SVG chevron', () => {
    const dom = new JSDOM(
        '<div class="sale_item_browser"><aside class="_1tOSyFfIWM42bIEwzvMp8v"><div class="_3aX5FdS6RjfaN8MCACBPf5"><div class="_3nsXKzSSkXGctsyIBw1RIF"><div class="_3X8r5nTmkQJqI-YG8Vl91b">Top-Level Genres</div></div></div></aside></div>',
        { url: 'https://store.steampowered.com/category/trains' },
    );
    Object.assign(globalThis, { MutationObserver: dom.window.MutationObserver });
    const ui = new SidebarUI(dom.window.document, async () => {});
    try {
        const doc = dom.window.document;
        const header = doc.querySelector('.aif-header')!;
        assert.ok(header.classList.contains('_3nsXKzSSkXGctsyIBw1RIF'));
        assert.ok(
            header.querySelector('.aif-heading')!.classList.contains('_3X8r5nTmkQJqI-YG8Vl91b'),
        );
        assert.equal(header.querySelector('svg')!.getAttribute('viewBox'), '0 0 24.833 21.917');
        assert.ok(header.querySelector('svg polygon'));
        assert.doesNotMatch(header.textContent!, /›/);
        assert.equal(doc.querySelector('[data-aif-search-summary]'), null);
    } finally {
        ui.stop();
        dom.window.close();
    }
});
