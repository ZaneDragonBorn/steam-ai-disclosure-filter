import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { parseDisclosure, appIdFromURL, SteamHTMLProvider } from '../webview/steam/provider';
import { DisclosureCache } from '../webview/cache/disclosures';
import { detectStoreCards, isSupportedStore } from '../webview/steam/surfaces';
import { normalizeSettings } from '../shared/settings';
import { FilterController } from '../webview/filtering/controller';
import { parseStoreBrowse, SteamDisclosureProvider } from '../webview/steam/storeBrowse';

function page(extra = '', id = 620) {
    return new JSDOM(`<link rel="canonical" href="https://store.steampowered.com/app/${id}/">
        <div id="appHubAppName">Fixture</div><div id="game_area_description"><h2>About This Game</h2>${extra}</div>`)
        .window.document;
}
test('only the official disclosure section matches, not descriptions or mature content', () => {
    assert.equal(parseDisclosure(page(), 620), false);
    assert.equal(parseDisclosure(page('<h2>AI Generated Content Disclosure</h2>'), 620), false);
    const doc = page();
    doc.body.insertAdjacentHTML(
        'beforeend',
        '<div id="game_area_content_descriptors"><h2>Mature Content Description</h2></div><div id="game_area_content_descriptors"><h2>AI Generated Content Disclosure</h2></div>',
    );
    assert.equal(parseDisclosure(doc, 620), true);
    assert.equal(parseDisclosure(doc, 999), null);
    assert.equal(parseDisclosure(new JSDOM('<h1>Access denied</h1>').window.document, 620), null);
    doc.body.insertAdjacentHTML('beforeend', '<form id="agecheck_form"></form>');
    assert.equal(parseDisclosure(doc, 620), null);
    const localized = page();
    localized.querySelector('h2')!.textContent = 'Über dieses Spiel';
    assert.equal(parseDisclosure(localized, 620), null);
});
test('strict App IDs and shared storefront scope', () => {
    assert.equal(appIdFromURL('/app/620/Portal_2?x=1'), 620);
    for (const url of [
        'https://evil.test/app/620',
        '/sub/620',
        '/app/0',
        '/app/620junk',
        '/app/999999999999999999',
    ])
        assert.equal(appIdFromURL(url), null);
    assert.equal(isSupportedStore('https://store.steampowered.com/sale/nextfest?tab=23'), true);
    assert.equal(isSupportedStore('https://store.steampowered.com/sale/other'), true);
    assert.equal(isSupportedStore('https://store.steampowered.com/account/'), false);
});
test('structured disclosure validates identity, success and requested details', () => {
    const item = {
        appid: 620,
        id: 620,
        item_type: 0,
        success: 1,
        visible: true,
        extra_details: {} as Record<string, unknown>,
    };
    const data = { response: { store_items: [item] } };
    assert.equal(parseStoreBrowse(data, 620), false);
    item.extra_details.content_survey_ai_notes = 'Official developer disclosure';
    assert.equal(parseStoreBrowse(data, 620), true);
    assert.equal(parseStoreBrowse(data, 999), null);
    item.extra_details.content_survey_ai_notes = 12;
    assert.equal(parseStoreBrowse(data, 620), null);
    item.success = 2;
    assert.equal(parseStoreBrowse(data, 620), null);
    assert.equal(parseStoreBrowse({}, 620), null);
});
test('structured provider does not fall back around rate limits', async () => {
    let calls = 0,
        fallbackCalls = 0;
    const fallback = new SteamHTMLProvider();
    fallback.hasAIDisclosure = async () => {
        fallbackCalls++;
        return false;
    };
    const provider = new SteamDisclosureProvider(fallback, async () => {
        calls++;
        return new Response('', { status: 429 });
    });
    assert.equal(await provider.hasAIDisclosure(620), null);
    assert.equal(await provider.hasAIDisclosure(621), null);
    assert.equal(calls, 1);
    assert.equal(fallbackCalls, 0);
});
test('unavailable structured route uses fallback and avoids repeated failed API calls', async () => {
    let calls = 0,
        fallbackCalls = 0;
    const fallback = new SteamHTMLProvider();
    fallback.hasAIDisclosure = async () => {
        fallbackCalls++;
        return true;
    };
    const provider = new SteamDisclosureProvider(fallback, async () => {
        calls++;
        throw new TypeError('CORS');
    });
    assert.equal(await provider.hasAIDisclosure(620), true);
    assert.equal(await provider.hasAIDisclosure(621), true);
    assert.equal(calls, 1);
    assert.equal(fallbackCalls, 2);
});
test('cache deduplicates, expires unknown, and bounds memory', async () => {
    let calls = 0,
        now = 0;
    const provider = {
        hasAIDisclosure: async () => {
            calls++;
            return null;
        },
    };
    const cache = new DisclosureCache(
        provider,
        () => true,
        () => now,
        0,
        2,
    );
    await Promise.all([cache.hasAIDisclosure(620), cache.hasAIDisclosure(620)]);
    assert.equal(calls, 1);
    await cache.hasAIDisclosure(620);
    assert.equal(calls, 1);
    now = 300_001;
    await cache.hasAIDisclosure(620);
    assert.equal(calls, 2);
    await cache.hasAIDisclosure(1);
    await cache.hasAIDisclosure(2);
    await cache.hasAIDisclosure(620);
    assert.equal(calls, 5);
});
test('disabled queue prevents traffic; provider failures fail open', async () => {
    let enabled = true,
        calls = 0;
    const cache = new DisclosureCache(
        {
            hasAIDisclosure: async () => {
                calls++;
                throw Error();
            },
        },
        () => enabled,
        Date.now,
        0,
        10,
    );
    assert.equal(await cache.hasAIDisclosure(1), null);
    assert.equal(await cache.hasAIDisclosure(2), null);
    assert.equal(calls, 2);
    enabled = false;
    assert.equal(await cache.hasAIDisclosure(3), null);
    assert.equal(calls, 2);
});
test('429 triggers cooldown and redirects are unknown', async () => {
    let calls = 0;
    const provider = new SteamHTMLProvider(async () => {
        calls++;
        return new Response('', { status: 429 });
    });
    assert.equal(await provider.hasAIDisclosure(620), null);
    assert.equal(await provider.hasAIDisclosure(621), null);
    assert.equal(calls, 1);
    const redirected = new SteamHTMLProvider(async () => {
        const response = new Response('ignored', { headers: { 'content-type': 'text/html' } });
        Object.defineProperty(response, 'url', {
            value: 'https://store.steampowered.com/agecheck/app/620/',
        });
        return response;
    });
    assert.equal(await redirected.hasAIDisclosure(620), null);
});

// Minimal structure captured from Next Fest Charts; synthetic IDs and title.
function card(id: number) {
    return `<div class="StoreSaleWidgetOuterContainer"><div class="ImpressionTrackedElement"><a href="/app/${id}/"><div class="CapsuleImageCtn"><img></div></a><a href="/app/${id}/"><div class="StoreSaleWidgetTitle">Fixture</div></a></div></div>`;
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 160));
test('dynamic cards, recycled IDs, retired reveal state, Off, navigation and cleanup', async () => {
    const dom = new JSDOM(
        `<div id="fixture" class="sale_item_browser">${card(1)}${card(2)}</div>`,
        { url: 'https://store.steampowered.com/sale/nextfest' },
    );
    const doc = dom.window.document;
    Object.assign(globalThis, { MutationObserver: dom.window.MutationObserver });
    const controller = new FilterController(doc, {
        hasAIDisclosure: async (id) => (id === 1 ? true : null),
    });
    const hidden = () => doc.querySelectorAll('[data-ai-disclosure-filter-hidden]').length;
    const settings = { mode: 'hide' as const, debug: false, revealUntil: 0 };
    try {
        controller.update(settings);
        await settle();
        assert.equal(hidden(), 1);
        controller.update(normalizeSettings({ ...settings, revealUntil: Date.now() + 10000 }));
        assert.equal(hidden(), 1);
        controller.update(settings);
        assert.equal(hidden(), 1);
        controller.update({ ...settings, mode: 'off' });
        assert.equal(hidden(), 0);
        controller.update(settings);
        const first = doc.querySelector('.ImpressionTrackedElement')!;
        for (const link of first.querySelectorAll('a')) link.href = '/app/2/';
        await settle();
        assert.equal(hidden(), 0);
        doc.querySelector('#fixture')!.insertAdjacentHTML('beforeend', card(1));
        await settle();
        assert.equal(hidden(), 1);
        dom.window.history.pushState({}, '', '/app/620/');
        controller.scan();
        assert.equal(hidden(), 0);
        dom.window.history.pushState({}, '', '/sale/nextfest');
        controller.scan();
        assert.equal(hidden(), 1);
        controller.stop();
        assert.equal(hidden(), 0);
    } finally {
        controller.stop();
        dom.window.close();
    }
});
test('mixed-app wrappers are never filtered as a single game', () => {
    const doc = new JSDOM(`<div class="sale_item_browser">${card(1)}</div>`, {
        url: 'https://store.steampowered.com/sale/nextfest',
    }).window.document;
    assert.equal(detectStoreCards(doc)[0].appId, 1);
    doc.querySelector('.ImpressionTrackedElement')!.insertAdjacentHTML(
        'beforeend',
        '<a href="/app/2/">Other game</a>',
    );
    assert.equal(detectStoreCards(doc).length, 0);
});
