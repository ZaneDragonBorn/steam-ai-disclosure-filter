import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { normalizeSettings } from '../shared/settings';
import { categoryFilterGroup, detectStoreCards, filterHosts } from '../webview/steam/surfaces';
import { SidebarUI } from '../webview/ui/sidebar';
import { FilterController } from '../webview/filtering/controller';

const fixture = readFileSync(new URL('./fixtures/category-browser.html', import.meta.url), 'utf8');
const tick = () => new Promise((resolve) => setTimeout(resolve, 160));

test('shared category component survives generated class and language changes on any route', () => {
    for (const path of ['/vr', '/tags/en/Sniper', '/category/action_fps', '/sale/future-event']) {
        // Keep only semantic Steam control/card classes; change every generated
        // name and all labels so this is not an English or per-category adapter.
        const html = fixture
            .replace(/[\w-]{11}-/g, 'future-hash')
            .replace(/Top-Level Genres|Genres|Filters|Search for a tag or option/g, 'Filtre');
        const dom = new JSDOM(html, { url: 'https://store.steampowered.com' + path });
        const doc = dom.window.document;
        assert.equal(filterHosts(doc).length, 1);
        const native = categoryFilterGroup(filterHosts(doc)[0])!;
        assert.equal(native.heading.textContent, 'Filtre');
        assert.deepEqual(
            detectStoreCards(doc).map(({ element, discovery }) => [element.id, discovery]),
            [
                ['listed', false],
                ['discovery', true],
            ],
        );
        dom.window.close();
    }
});

test('category slider applies listing policy without changing adjacent discovery policy', async () => {
    const dom = new JSDOM(fixture, { url: 'https://store.steampowered.com/vr' });
    const doc = dom.window.document;
    Object.assign(globalThis, { MutationObserver: dom.window.MutationObserver });
    const controller = new FilterController(doc, {
        hasAIDisclosure: async () => true,
        getNotes: () => 'AI-generated assets',
    });
    const ui = new SidebarUI(doc, async (patch) => {
        const settings = normalizeSettings({ mode: 'off', discoveryMode: 'off', ...patch });
        controller.update(settings);
        ui.update(settings);
    });
    try {
        ui.mount();
        ui.mount();
        assert.equal(doc.querySelectorAll('[data-aif-panel]').length, 1);
        const native = categoryFilterGroup(filterHosts(doc)[0])!;
        const panel = doc.querySelector('[data-aif-panel]')!;
        assert.equal(panel.nextElementSibling, native.group);
        assert.ok(panel.querySelector('.aif-header')!.classList.contains('A2HZ4hMXGp4-'));
        const slider = panel.querySelector<HTMLInputElement>('input[type=range]')!;
        slider.value = '3';
        slider.dispatchEvent(new dom.window.Event('change'));
        await tick();
        assert.equal(
            doc.querySelector('#listed')!.getAttribute('data-ai-disclosure-filter-hidden'),
            'true',
        );
        assert.equal(
            doc.querySelector('#discovery')!.hasAttribute('data-ai-disclosure-filter-hidden'),
            false,
        );
        slider.value = '0';
        slider.dispatchEvent(new dom.window.Event('change'));
        await tick();
        assert.equal(
            doc.querySelector('#listed')!.hasAttribute('data-ai-disclosure-filter-hidden'),
            false,
        );
    } finally {
        controller.stop();
        ui.stop();
        dom.window.close();
    }
});

test('category sidebar mounts after cards arrive and survives empty results and native rerender', async () => {
    const dom = new JSDOM(fixture, { url: 'https://store.steampowered.com/tags/en/Sniper' });
    const doc = dom.window.document;
    Object.assign(globalThis, { MutationObserver: dom.window.MutationObserver });
    const card = doc.querySelector('#listed')!;
    const listing = card.parentElement!;
    card.remove();
    const ui = new SidebarUI(doc, async () => {});
    try {
        ui.mount();
        assert.equal(filterHosts(doc).length, 0);
        listing.append(card);
        await tick();
        assert.equal(doc.querySelectorAll('[data-aif-panel]').length, 1);
        card.remove();
        ui.mount();
        assert.equal(doc.querySelectorAll('[data-aif-panel]').length, 1);
        listing.append(card);
        const host = filterHosts(doc)[0];
        const replacement = host.cloneNode(true) as HTMLElement;
        replacement.querySelector('[data-aif-panel]')!.remove();
        host.replaceWith(replacement);
        await tick();
        assert.equal(doc.querySelectorAll('[data-aif-panel]').length, 1);
    } finally {
        ui.stop();
        dom.window.close();
    }
});

test('native search controls and unrelated arrow menus do not become category hosts', () => {
    const dom = new JSDOM(
        '<nav><input class="DialogInput"><div>Browse<svg viewBox="0 0 24 24"><polygon></polygon></svg></div></nav><div class="LibraryAssetExpandedDisplay"><a href="/app/620/">Portal</a></div>',
        { url: 'https://store.steampowered.com/' },
    );
    assert.deepEqual(filterHosts(dom.window.document), []);
    dom.window.close();
});
