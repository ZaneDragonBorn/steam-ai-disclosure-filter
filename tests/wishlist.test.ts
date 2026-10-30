import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { detectStoreCards } from '../webview/steam/surfaces';
import { isWishlistURL, wishlistOptions } from '../webview/steam/wishlist';
import { FilterController } from '../webview/filtering/controller';
import { WishlistUI } from '../webview/ui/wishlist';
import { normalizeSettings } from '../shared/settings';
import { reconcilePolicy } from '../webview/config';

const form =
    '<form><section class="Focusable"><h3>View</h3><label class="Focusable"><input type="radio" name="viewmode" value="expanded" checked>Expanded</label><label><input type="radio" name="viewmode" value="compact">Compact</label></section><section><h3>Platform</h3><input name="platform" type="radio" value="all" checked></section><section><h3>Price</h3><input type="range" id="priceFiltersRange-fixture" class="Focusable"><label for="priceFiltersRange-fixture" class="qhUI2RnjHYw-">Any Price</label></section><button type="button">Notification Settings</button></form>';
const row = (index: number, id: number) =>
    `<div data-index="${index}" class="Panel" style="width:100%;padding-bottom:0"><div class="S2Q8eqrNOA4-"><div class="PE-3oq-yIvg- Panel" role="button"><input class="rank" value="${index + 1}"><a href="/app/${id}/"><img src="https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/hash/header.jpg"></a><div class="P-zVPa2bdmQ-"><a href="/app/${id}/">Game ${id}</a></div><div class="uQ8Li0MwEhQ-"><div>Release Date: 2026</div><div>English Reviews: Positive</div></div><button class="tag">Action</button><button class="remove">Remove</button><button class="cart">Add to Cart</button></div></div></div>`;
const page = () =>
    new JSDOM(
        `<div class="awGgT3ZKumU-"><div class="DFhzzTUhoEs- Panel">${form}</div><div class="Panel" data-fixture-active><button class="cDJOlrqyRq8- n5jTCXrzS8A- Focusable">Platform: macOS</button></div><div class="PLkUpk974nY-"><div class="Panel" style="height:348px;position:relative"><div class="track" style="position:absolute;transform:translateY(0px)">${row(0, 1)}${row(1, 2)}</div></div></div></div>`,
        { url: 'https://store.steampowered.com/wishlist/id/fixture/' },
    );
const wait = () => new Promise((resolve) => setTimeout(resolve, 180));

test('Wishlist detection owns whole indexed rows and rejects artwork-only/mixed rows', () => {
    const dom = page(),
        doc = dom.window.document;
    try {
        assert.equal(isWishlistURL(doc.location.href), true);
        assert.equal(isWishlistURL('https://evil.test/wishlist/'), false);
        assert.deepEqual(
            detectStoreCards(doc).map((c) => [
                c.appId,
                c.element.dataset.index,
                c.discovery,
                c.wishlist,
            ]),
            [
                [1, '0', false, true],
                [2, '1', false, true],
            ],
        );
        doc.querySelector('[data-index="0"]')!.insertAdjacentHTML(
            'beforeend',
            '<a href="/app/3/">Another app</a>',
        );
        assert.deepEqual(
            detectStoreCards(doc).map((c) => c.appId),
            [2],
        );
        doc.querySelector('.PLkUpk974nY-')!.remove();
        doc.body.insertAdjacentHTML(
            'beforeend',
            '<a href="/app/4/"><img src="https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/4/hash/header.jpg"></a>',
        );
        assert.equal(detectStoreCards(doc).length, 0);
    } finally {
        dom.window.close();
    }
});

test('Wishlist policy is independent of discovery protection and preserves controls, indices and metadata', async () => {
    const dom = page(),
        doc = dom.window.document;
    Object.assign(globalThis, { MutationObserver: dom.window.MutationObserver });
    const before = [...doc.querySelectorAll('.rank,.tag,.cart,.remove')],
        track = doc.querySelector('.track')!,
        style = track.getAttribute('style');
    let clicks = 0;
    doc.querySelector('.tag')!.addEventListener('click', () => clicks++);
    const ui = new FilterController(doc, {
        hasAIDisclosure: async (id) => (id === 1 ? true : null),
        getNotes: () => 'We generate AI artwork.',
    });
    try {
        ui.update(
            normalizeSettings({ mode: 'hide', discoveryMode: 'hide', preserveWishlist: true }),
        );
        await wait();
        assert.equal(doc.querySelector('[data-ai-disclosure-filter-hidden]'), null);
        assert.equal(doc.querySelectorAll('.uQ8Li0MwEhQ- [data-aif-badge]').length, 1);
        assert.equal(doc.querySelector('a [data-aif-badge]'), null);
        ui.update(normalizeSettings({ wishlistMode: 'hide', preserveWishlist: true }));
        const hidden = doc.querySelector<HTMLElement>('[data-ai-disclosure-filter-hidden]')!;
        assert.equal(hidden.dataset.index, '0');
        assert.equal(dom.window.getComputedStyle(hidden).display, 'none');
        assert.equal(doc.querySelector('[data-aif-slot-hidden]'), null);
        assert.equal(track.getAttribute('style'), style);
        assert.deepEqual([...doc.querySelectorAll('.rank,.tag,.cart,.remove')], before);
        doc.querySelector<HTMLButtonElement>('.tag')!.click();
        assert.equal(clicks, 1);
        ui.update(normalizeSettings({ wishlistMode: 'hide', allowedApps: [1], showAITags: false }));
        assert.equal(doc.querySelector('[data-ai-disclosure-filter-hidden]'), null);
        assert.equal(doc.querySelector('[data-aif-badge]'), null);
        ui.update(normalizeSettings({ wishlistMode: 'hide' }));
        for (const a of hidden.querySelectorAll('a')) a.href = '/app/2/';
        await wait();
        assert.equal(doc.querySelector('[data-ai-disclosure-filter-hidden]'), null);
        assert.equal(doc.querySelector('[data-aif-badge]'), null);
        track.insertAdjacentHTML('beforeend', row(2, 1));
        await wait();
        assert.equal(doc.querySelectorAll('[data-ai-disclosure-filter-hidden]').length, 1);
    } finally {
        ui.stop();
        assert.equal(doc.querySelector('[data-ai-disclosure-filter-hidden]'), null);
        dom.window.close();
    }
});

test('Wishlist Options matches native schema, supports named presets and remounts without replacing Steam controls', async () => {
    const dom = page(),
        doc = dom.window.document;
    Object.assign(globalThis, { MutationObserver: dom.window.MutationObserver });
    const native = [...doc.querySelectorAll('input,button')];
    let settings = normalizeSettings({});
    let changes = 0;
    const nativeForm = doc.querySelector('form')!;
    nativeForm.addEventListener('change', () => changes++);
    const ui = new WishlistUI(doc, async (patch) => {
        settings = normalizeSettings({ ...settings, ...patch });
        ui.update(settings);
    });
    try {
        ui.update(settings);
        assert.equal(wishlistOptions(doc).length, 1);
        assert.equal(doc.querySelectorAll('[data-aif-wishlist-options]').length, 1);
        const range = doc.querySelector<HTMLInputElement>(
            '[data-aif-wishlist-options] input[type=range]',
        )!;
        range.value = '3';
        range.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
        await Promise.resolve();
        assert.equal(settings.wishlistMode, 'hide');
        assert.equal(changes, 0);
        doc.querySelector<HTMLInputElement>('input[name=viewmode][value=compact]')!.click();
        assert.equal(changes, 1);
        assert.ok(native.every((node) => node.isConnected));
        assert.equal(doc.querySelectorAll('[data-aif-wishlist-options]').length, 1);
        settings = normalizeSettings({
            ...settings,
            customFilters: [
                {
                    id: 'audio',
                    name: 'No voices',
                    categories: ['audio'],
                    phrases: [],
                    match: 'any',
                },
            ],
            filterOrder: ['hide', 'custom:audio', 'light', 'custom'],
        });
        ui.update(settings);
        assert.deepEqual(
            JSON.parse(
                doc.querySelector<HTMLElement>('[data-aif-wishlist-options]')!.dataset.presets!,
            ).map((preset: { mode: string }) => preset.mode),
            ['off', 'hide', 'custom:audio', 'light', 'custom'],
        );
        assert.equal(doc.querySelector('.aif-wishlist-status'), null);
        assert.doesNotMatch(
            doc.querySelector('[data-aif-wishlist-options]')!.textContent!,
            /cards hidden|Complete/,
        );
        doc.querySelector('form')!.remove();
        doc.body.insertAdjacentHTML('afterbegin', form);
        await wait();
        assert.equal(doc.querySelectorAll('[data-aif-wishlist-options]').length, 1);
        assert.equal(
            doc
                .querySelector<HTMLInputElement>('[data-aif-wishlist-options] input[type=range]')!
                .getAttribute('aria-valuetext'),
            'Hide Disclosed',
        );
    } finally {
        ui.stop();
        assert.equal(doc.querySelector('[data-aif-wishlist-options]'), null);
        assert.equal(doc.querySelectorAll('input[name=viewmode]').length, 2);
        dom.window.close();
    }
});

test('Wishlist settings survive policy reconciliation without changing storefront selection', () => {
    assert.equal(normalizeSettings({}).wishlistMode, 'off');
    assert.equal(normalizeSettings({ wishlistMode: 'garbage' }).wishlistMode, 'off');
    const next = reconcilePolicy(
        { mode: 'light', defaultMode: 'light', wishlistMode: 'off' },
        { defaultMode: 'light', wishlistMode: 'hide' },
    )!;
    assert.equal(next.mode, 'light');
    assert.equal(next.wishlistMode, 'hide');
});

test('Wishlist slider stays fixed with 30 custom filters, updates automatically and preserves native chips', async () => {
    const dom = page(),
        doc = dom.window.document;
    Object.assign(globalThis, { MutationObserver: dom.window.MutationObserver });
    let settings = normalizeSettings({});
    const saves: string[] = [];
    const ui = new WishlistUI(doc, async (patch) => {
        saves.push(patch.wishlistMode!);
        settings = normalizeSettings({ ...settings, ...patch });
        ui.update(settings);
    });
    try {
        const nativeChip = doc.querySelector('[data-fixture-active] button')!;
        ui.update(settings);
        const group = doc.querySelector<HTMLElement>('[data-aif-wishlist-options]')!;
        assert.equal(group.style.gridColumn, '');
        assert.equal(group.style.alignSelf, 'start');
        assert.equal(group.querySelector('.aif-wishlist-description'), null);
        const slider = group.querySelector<HTMLInputElement>('input[type=range]')!;
        const originalStyle = slider.style.cssText;
        for (const [index, label] of [
            'Show All',
            'Light Usage',
            'Custom',
            'Hide Disclosed',
        ].entries()) {
            slider.value = String(index);
            slider.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
            await Promise.resolve();
            assert.equal(slider.getAttribute('aria-valuetext'), label);
            assert.ok(slider.title.length > 0);
            const chip = doc.querySelector('[data-aif-wishlist-active]');
            if (index) {
                assert.equal(chip!.textContent, 'Gen AI: ' + label);
                assert.equal(chip!.parentElement, nativeChip.parentElement);
            } else assert.equal(chip, null);
        }
        settings = normalizeSettings({
            ...settings,
            customFilters: Array.from({ length: 30 }, (_, i) => ({
                id: 'rule' + i,
                name: 'Custom filter ' + i,
                categories: ['audio'],
                phrases: [],
                match: 'any',
            })),
        });
        ui.update(settings);
        assert.equal(slider.max, '33');
        assert.equal(group.querySelectorAll('datalist option').length, 34);
        assert.equal(slider.style.cssText, originalStyle);
        assert.equal(slider.style.width, '100%');
        assert.equal(group.querySelector('button'), null);
        assert.equal(group.querySelector('.aif-wishlist-viewport'), null);
        assert.equal(group.querySelector('.aif-wishlist-names'), null);
        assert.equal(slider.getAttribute('aria-valuetext'), 'Hide Disclosed');
        for (let i = 0; i < 30; i++) {
            slider.value = String(i + 4);
            slider.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
            await Promise.resolve();
            assert.equal(settings.wishlistMode, 'custom:rule' + i);
            assert.equal(slider.getAttribute('aria-valuetext'), 'Custom filter ' + i);
        }
        const nativeRow = nativeChip.parentElement!;
        nativeRow.replaceWith(nativeRow.cloneNode(false));
        await wait();
        assert.equal(doc.querySelectorAll('[data-aif-wishlist-active]').length, 1);
        doc.querySelector<HTMLButtonElement>('[data-aif-wishlist-active]')!.click();
        await Promise.resolve();
        assert.equal(settings.wishlistMode, 'off');
        assert.equal(slider.value, '0');
        assert.equal(doc.querySelector('[data-aif-wishlist-active]'), null);
        assert.ok(saves.includes('custom:rule29'));
        assert.equal(group.querySelector('.aif-wishlist-status'), null);
    } finally {
        ui.stop();
        dom.window.close();
    }
});
