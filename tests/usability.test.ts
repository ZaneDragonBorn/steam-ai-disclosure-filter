import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { SidebarUI } from '../webview/ui/sidebar';
import {
    availablePresets,
    normalizeSettings,
    reorderPresets,
    shouldHide,
} from '../shared/settings';
import { classifyDisclosure } from '../shared/classification';

test('all presets reorder persistently, Show All is locked and stale IDs are removed', () => {
    let settings = normalizeSettings({
        customFilters: [
            { id: 'voices', name: 'Voices', categories: ['audio'], phrases: [], match: 'any' },
        ],
    });
    settings = normalizeSettings({
        ...settings,
        filterOrder: reorderPresets(settings, 'custom:voices', 'light'),
    });
    assert.deepEqual(
        availablePresets(settings).map((p) => p.mode),
        ['off', 'custom:voices', 'light', 'custom', 'hide'],
    );
    settings = normalizeSettings({
        ...settings,
        filterOrder: reorderPresets(settings, 'hide', 'custom:voices'),
    });
    assert.deepEqual(
        availablePresets(settings).map((p) => p.mode),
        ['off', 'hide', 'custom:voices', 'light', 'custom'],
    );
    assert.deepEqual(reorderPresets(settings, 'off', 'hide'), settings.filterOrder);
    assert.deepEqual(reorderPresets(settings, 'hide', 'off'), settings.filterOrder);
    const reloaded = normalizeSettings(JSON.parse(JSON.stringify(settings)));
    assert.deepEqual(availablePresets(reloaded), availablePresets(settings));
    const deleted = normalizeSettings({
        ...settings,
        customFilters: [],
        filterOrder: ['off', 'hide', 'custom:voices', 'hide', 'garbage'],
    });
    assert.deepEqual(
        availablePresets(deleted).map((p) => p.mode),
        ['off', 'hide', 'light', 'custom'],
    );
});

test('quick review follows actual blocking policy, not all detected disclosures', () => {
    const dom = new JSDOM('<aside id="additional_search_options"></aside>', {
        url: 'https://store.steampowered.com/search/',
    });
    Object.assign(globalThis, { MutationObserver: dom.window.MutationObserver });
    const ui = new SidebarUI(dom.window.document, async () => {});
    const doc = dom.window.document;
    const apps = [
        {
            appId: 1,
            title: 'Translation game',
            notes: 'AI is used for translation.',
            allowed: false,
        },
        {
            appId: 2,
            title: 'Asset game',
            notes: 'Our team uses generative AI to develop some in-game assets.',
            allowed: false,
        },
    ];
    try {
        ui.update(normalizeSettings({ mode: 'off' }));
        ui.review(apps, 0, 2, false);
        assert.equal(doc.querySelectorAll('article').length, 0);
        assert.match(
            doc.querySelector('.aif-review')!.textContent!,
            /No titles are currently blocked/,
        );
        ui.update(normalizeSettings({ mode: 'light' }));
        assert.equal(doc.querySelectorAll('article').length, 1);
        assert.match(doc.querySelector('article')!.textContent!, /Asset game/);
        ui.update(normalizeSettings({ mode: 'hide' }));
        assert.equal(doc.querySelectorAll('article').length, 2);
        ui.update(normalizeSettings({ mode: 'hide', allowedApps: [2] }));
        assert.equal(doc.querySelectorAll('article').length, 1);
        const search = doc.querySelector<HTMLInputElement>('input[type=search]')!;
        assert.equal(search.placeholder, 'Search blocked titles');
        search.value = 'asset';
        search.dispatchEvent(new dom.window.Event('input'));
        assert.equal(doc.querySelectorAll('article').length, 0);
        const info = doc.querySelector<HTMLButtonElement>('.aif-info')!;
        info.click();
        assert.equal(info.getAttribute('aria-expanded'), 'true');
        assert.match(doc.querySelector('.aif-management-info')!.textContent!, /Steam App ID/);
        assert.equal(doc.querySelector<HTMLElement>('.aif-management-info')!.hidden, false);
        info.click();
        assert.equal(doc.querySelector<HTMLElement>('.aif-management-info')!.hidden, true);
    } finally {
        ui.stop();
        dom.window.close();
    }
});

test('search header including status dot is one button with no arrow and native animation', () => {
    const dom = new JSDOM(
        '<aside id="additional_search_options"><div class="search_collapse_block"><div class="block_header" style="background-color:rgb(45,55,65);color:rgb(190,200,210)">Native</div></div></aside>',
        { url: 'https://store.steampowered.com/search/' },
    );
    Object.assign(globalThis, { MutationObserver: dom.window.MutationObserver });
    const doc = dom.window.document;
    let up = 0,
        down = 0;
    (dom.window as any).$J = () => ({
        stop: () => {},
        slideUp: (_s: string, done: () => void) => {
            up++;
            done();
        },
        slideDown: () => {
            down++;
        },
    });
    const ui = new SidebarUI(doc, async () => {});
    try {
        const header = doc.querySelector<HTMLButtonElement>('.aif-header')!;
        assert.equal(header.tagName, 'BUTTON');
        assert.ok(header.contains(doc.querySelector('.aif-dot')));
        assert.equal(header.style.backgroundColor, 'rgb(45, 55, 65)');
        assert.equal(doc.querySelector('.aif-chevron'), null);
        assert.equal(doc.querySelector('select'), null);
        doc.querySelector<HTMLElement>('.aif-dot')!.click();
        assert.equal(header.getAttribute('aria-expanded'), 'false');
        header.click();
        assert.equal(header.getAttribute('aria-expanded'), 'true');
        assert.equal(up, 1);
        assert.equal(down, 1);
    } finally {
        ui.stop();
        dom.window.close();
    }
});

test('concrete asset and player illustration disclosures avoid Unclear without implying Heavy', () => {
    const assets = 'Our team uses generative AI tools to help develop some in game assets.';
    const maple =
        'Generative AI is used for two features: - To allow players to create a custom illustration of their character reflecting their personalized appearance and equipped items for in-game use. - To assist with translation for languages other than English.';
    assert.equal(classifyDisclosure(assets).key, 'visual');
    assert.equal(classifyDisclosure(maple).key, 'interactive');
    assert.deepEqual(classifyDisclosure(maple).categories, ['visual', 'interactive']);
    assert.equal(
        classifyDisclosure(
            'We use generative AI. Players can create custom illustrations of their characters.',
        ).key,
        'interactive',
    );
    assert.equal(
        classifyDisclosure('No AI is used to develop in-game assets. AI is used for translation.')
            .key,
        'light',
    );
    assert.equal(
        classifyDisclosure('AI concept assets were replaced before release.').key,
        'light',
    );
    assert.equal(classifyDisclosure('We use generative AI tools.').key, 'unclassified');
    assert.equal(shouldHide(normalizeSettings({ mode: 'hide' }), 1, true, maple), true);
});

test('pointer-captured ordering works without native HTML drag and rejects locked/cross-list drops', async () => {
    const { FilterOrderDrag } = await import('../frontend/ordering');
    const dom = new JSDOM(
        '<div data-aif-order-list><div data-aif-order="off"><span>All</span></div><div data-aif-order="light"><span>Light</span></div><div data-aif-order="hide"><span>Hide</span></div></div><div data-aif-order-list><div data-aif-order="custom"><span>Other list</span></div></div>',
    );
    const doc = dom.window.document;
    const handle = doc.querySelector<HTMLElement>('[data-aif-order="hide"] span')!;
    const drag = new FilterOrderDrag();
    const drops: string[][] = [];
    drag.onDrop = (a, b) => drops.push([a, b.mode, b.side]);
    const event = (y: number) =>
        ({ button: 0, pointerId: 1, clientX: 10, clientY: y, preventDefault() {} }) as PointerEvent;
    let target: Element = doc.querySelector('[data-aif-order="light"] span')!;
    doc.elementFromPoint = () => target;
    for (const [i, row] of [
        ...doc.querySelectorAll<HTMLElement>('[data-aif-order-list]:first-child [data-aif-order]'),
    ].entries())
        row.getBoundingClientRect = () => ({ top: i * 40, height: 32 }) as DOMRect;
    try {
        drag.down(event(50), handle, 'hide');
        drag.move(event(45));
        drag.up(event(45));
        assert.deepEqual(drops, [['hide', 'light', 'before']]);
        target = doc.querySelector('[data-aif-order="off"] span')!;
        drag.down(event(50), handle, 'hide');
        drag.move(event(10));
        drag.up(event(10));
        assert.equal(drops.length, 1);
        target = doc.querySelector('[data-aif-order="custom"] span')!;
        drag.down(event(50), handle, 'hide');
        drag.move(event(10));
        drag.up(event(10));
        assert.equal(drops.length, 1);
        drag.down(event(50), handle, 'off');
        drag.move(event(10));
        drag.up(event(10));
        assert.equal(drops.length, 1);
        target = doc.querySelector('[data-aif-order="light"] span')!;
        drag.down(event(50), handle, 'hide');
        drag.up(event(50));
        assert.equal(drops.length, 1);
        drag.down(event(50), handle, 'hide');
        drag.move(event(10));
        drag.cancel();
        drag.up(event(10));
        assert.equal(drops.length, 1);
    } finally {
        drag.cancel();
        dom.window.close();
    }
});

test('drag insertion preview matches the saved boundary above, below and between filters', async () => {
    const { FilterOrderDrag } = await import('../frontend/ordering');
    const dom = new JSDOM(
        '<div data-aif-order-list>' +
            ['off', 'light', 'custom', 'hide']
                .map((m) => '<div data-aif-order="' + m + '"><span>' + m + '</span></div>')
                .join('') +
            '</div>',
    );
    const doc = dom.window.document,
        list = doc.querySelector<HTMLElement>('[data-aif-order-list]')!;
    const rows = [...list.querySelectorAll<HTMLElement>('[data-aif-order]')];
    rows.forEach(
        (row, i) => (row.getBoundingClientRect = () => ({ top: i * 40, height: 32 }) as DOMRect),
    );
    const drag = new FilterOrderDrag();
    const settings = normalizeSettings({});
    let feedback: unknown,
        saved: string[] = [];
    drag.onFeedback = (_, target) => (feedback = target);
    drag.onDrop = (source, target) => {
        saved = reorderPresets(settings, source, target.mode, target.side);
    };
    const event = (y: number) =>
        ({ button: 0, pointerId: 1, clientX: 10, clientY: y, preventDefault() {} }) as PointerEvent;
    let hit: Element = rows[3];
    doc.elementFromPoint = () => hit;
    try {
        drag.down(event(45), rows[1].querySelector('span')!, 'light');
        drag.move(event(125));
        assert.deepEqual(feedback, { mode: 'hide', side: 'before' });
        drag.up(event(125));
        assert.deepEqual(saved, ['custom', 'light', 'hide']);
        drag.down(event(45), rows[1].querySelector('span')!, 'light');
        drag.move(event(150));
        assert.deepEqual(feedback, { mode: 'hide', side: 'after' });
        drag.up(event(150));
        assert.deepEqual(saved, ['custom', 'hide', 'light']);
        hit = rows[1];
        drag.down(event(125), rows[3].querySelector('span')!, 'hide');
        drag.move(event(45));
        assert.deepEqual(feedback, { mode: 'light', side: 'before' });
        drag.up(event(45));
        assert.deepEqual(saved, ['hide', 'light', 'custom']);
        hit = list; // The gap after Light, before Custom.
        drag.down(event(125), rows[3].querySelector('span')!, 'hide');
        drag.move(event(77));
        assert.deepEqual(feedback, { mode: 'custom', side: 'before' });
        drag.up(event(77));
        assert.deepEqual(saved, ['light', 'hide', 'custom']);
        assert.equal(feedback, null);
        assert.deepEqual(reorderPresets(settings, 'light', 'off', 'before'), [
            'light',
            'custom',
            'hide',
        ]);
    } finally {
        drag.cancel();
        dom.window.close();
    }
});
