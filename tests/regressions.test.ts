import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { SteamDisclosureProvider } from '../webview/steam/storeBrowse';
import { SteamHTMLProvider } from '../webview/steam/provider';
import { DisclosureCache } from '../webview/cache/disclosures';
import { FilterController } from '../webview/filtering/controller';
import { isLightDisclosure, normalizeSettings, shouldHide } from '../shared/settings';
import { rankApps } from '../shared/history';
const sample = JSON.parse(
    readFileSync(new URL('./fixtures/storebrowse.json', import.meta.url), 'utf8'),
);

test('live Steam fixture: ARC Raiders hides, Portal 2 stays; prefetch in Show All and immediate preset switch', async () => {
    let requests = 0;
    const provider = new SteamDisclosureProvider(new SteamHTMLProvider(), async (url) => {
        requests++;
        const query = JSON.parse(new URL(String(url)).searchParams.get('input_json')!);
        assert.deepEqual(query.ids, [{ appid: 1808500 }, { appid: 620 }]);
        return new Response(JSON.stringify(sample), {
            headers: { 'content-type': 'application/json' },
        });
    });
    const dom = new JSDOM(
        '<div id="search_resultsRows"><a class="search_result_row" href="/app/1808500/">ARC Raiders</a><a class="search_result_row" href="/app/620/">Portal 2</a></div>',
        { url: 'https://store.steampowered.com/search/' },
    );
    Object.assign(globalThis, { MutationObserver: dom.window.MutationObserver });
    // A non-intersecting viewport must no longer prevent checks.
    Object.assign(globalThis, {
        IntersectionObserver: class {
            observe() {}
            disconnect() {}
            unobserve() {}
        },
    });
    const controller = new FilterController(dom.window.document, new DisclosureCache(provider));
    const hidden = () => dom.window.document.querySelectorAll('[data-ai-disclosure-filter-hidden]');
    try {
        controller.update(normalizeSettings({ mode: 'off' }));
        await new Promise((r) => setTimeout(r, 200));
        assert.equal(requests, 1);
        assert.equal(hidden().length, 0);
        controller.update(normalizeSettings({ mode: 'hide', revealUntil: Date.now() + 300000 }));
        assert.equal(hidden().length, 1);
        assert.match(hidden()[0].getAttribute('href')!, /1808500/);
        assert.match(provider.getNotes(1808500)!, /development process/);
        assert.ok(provider.getMetadata(1808500)!.reviewCount! > 100000);
        controller.update(normalizeSettings({ mode: 'hide', allowedApps: [1808500] }));
        assert.equal(hidden().length, 0);
    } finally {
        controller.stop();
        dom.window.close();
        delete (globalThis as any).IntersectionObserver;
    }
});

test('160 apps use four batches, overlap at two maximum, and are not truncated at 120', async () => {
    let active = 0,
        max = 0;
    const batches: number[][] = [];
    const cache = new DisclosureCache({
        hasAIDisclosure: async () => {
            throw Error('should batch');
        },
        hasAIDisclosures: async (ids) => {
            batches.push(ids);
            active++;
            max = Math.max(max, active);
            await new Promise((r) => setTimeout(r, 20));
            active--;
            return new Map(ids.map((id) => [id, id === 160]));
        },
    });
    const results = await Promise.all(
        Array.from({ length: 160 }, (_, i) => cache.hasAIDisclosure(i + 1)),
    );
    assert.equal(results[159], true);
    assert.equal(batches.length, 4);
    assert.equal(max, 2);
    await cache.hasAIDisclosure(160);
    assert.equal(batches.length, 4);
});

test('missing member in a batch is unknown, never borrowed from another app', async () => {
    const fallback = new SteamHTMLProvider();
    fallback.hasAIDisclosure = async () => null;
    const provider = new SteamDisclosureProvider(
        fallback,
        async () =>
            new Response(JSON.stringify(sample), {
                headers: { 'content-type': 'application/json' },
            }),
    );
    const result = await provider.hasAIDisclosures([1808500, 620, 999]);
    assert.equal(result.get(1808500), true);
    assert.equal(result.get(620), false);
    assert.equal(result.get(999), null);
});

test('Light Usage admits explicit exclusive translation only, not vague or mixed disclosures', () => {
    assert.equal(
        isLightDisclosure(
            'Generative AI is used only for translation from Japanese to English. Generative AI is not used for the game’s visual assets or system programs.',
        ),
        true,
    );
    for (const text of [
        'AI is used only for translation. We also generate music.',
        'All artwork is human reviewed. No runtime AI.',
    ])
        assert.equal(isLightDisclosure(text), false);
    assert.equal(shouldHide(normalizeSettings({ mode: 'light' }), 620, null), false);
    assert.equal(
        shouldHide(
            normalizeSettings({ mode: 'light' }),
            1,
            true,
            'AI is used only for localization.',
        ),
        false,
    );
});

test('native history ranks review volume first, positive percentage breaks ties', () => {
    const base = { notes: 'disclosure', allowed: false };
    assert.deepEqual(
        rankApps([
            { ...base, appId: 1, title: 'A', reviewCount: 10, percentPositive: 99 },
            { ...base, appId: 2, title: 'B', reviewCount: 100, percentPositive: 70 },
            { ...base, appId: 3, title: 'C', reviewCount: 100, percentPositive: 90 },
        ]).map((a) => a.appId),
        [3, 2, 1],
    );
});

test('Starlight-bound configuration calls do not pass the plugin ID twice', () => {
    // The official compiler injects pluginName into imported configuration APIs.
    for (const file of ['../webview/preload.ts', '../frontend/index.tsx']) {
        const source = readFileSync(new URL(file, import.meta.url), 'utf8');
        assert.doesNotMatch(source, /PLUGIN_ID|dev\.wyatt\.ai-disclosure-filter/);
    }
});

test('default fetch transport retains the browser receiver', async () => {
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async function (this: unknown) {
        assert.equal(this, globalThis, 'Chromium requires the Window receiver');
        calls++;
        return new Response(JSON.stringify(sample), {
            headers: { 'content-type': 'application/json' },
        });
    } as typeof fetch;
    try {
        const provider = new SteamDisclosureProvider();
        assert.equal(await provider.hasAIDisclosure(1808500), true);
        assert.equal(calls, 1);
    } finally {
        globalThis.fetch = original;
    }
});

test('approved ARC Raiders development wording is allowed only by Light, never Hide Disclosed', () => {
    const notes = sample.response.store_items[0].extra_details.content_survey_ai_notes;
    assert.equal(shouldHide(normalizeSettings({ mode: 'light' }), 1808500, true, notes), false);
    assert.equal(shouldHide(normalizeSettings({ mode: 'hide' }), 1808500, true, notes), true);
    assert.equal(isLightDisclosure(notes + ' We also generate artwork.'), false);
});
