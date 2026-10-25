import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { detectStoreCards, filterHosts } from '../webview/steam/surfaces';
import { FilterController } from '../webview/filtering/controller';
import { normalizeSettings } from '../shared/settings';
const wait = () => new Promise((r) => setTimeout(r, 160));
test('shared sale sidebar works without legacy browser wrapper and discovery is independent', async () => {
    const dom = new JSDOM(
        `<section><aside class="_1tOSyFfIWM42bIEwzvMp8v"></aside><div class="LibraryAssetExpandedDisplay"><a href="/app/1/">List</a><div class="StoreSaleWidgetTitle">List</div></div></section><a class="store_main_capsule" href="/app/2/"><div class="app_name">Featured</div></a><a class="sale_capsule ds_wishlist" href="/app/3/"><img></a><a class="sale_capsule" href="/app/4/"><img></a>`,
        { url: 'https://store.steampowered.com/sale/new-event' },
    );
    Object.assign(globalThis, { MutationObserver: dom.window.MutationObserver });
    const doc = dom.window.document;
    assert.equal(filterHosts(doc).length, 1);
    assert.deepEqual(
        detectStoreCards(doc).map((c) => [c.appId, c.discovery, c.wishlisted]),
        [
            [1, false, false],
            [2, true, false],
            [3, true, true],
            [4, true, false],
        ],
    );
    const controller = new FilterController(doc, {
        hasAIDisclosure: async () => true,
        getNotes: () => 'AI-generated artwork',
    });
    try {
        controller.update(normalizeSettings({ mode: 'hide' }));
        await wait();
        assert.equal(doc.querySelectorAll('[data-ai-disclosure-filter-hidden]').length, 1);
        controller.update(normalizeSettings({ mode: 'off', discoveryMode: 'hide' }));
        assert.equal(doc.querySelectorAll('[data-ai-disclosure-filter-hidden]').length, 2);
        assert.equal(
            doc.querySelector('.ds_wishlist')!.hasAttribute('data-ai-disclosure-filter-hidden'),
            false,
        );
        controller.update(
            normalizeSettings({ mode: 'off', discoveryMode: 'hide', preserveWishlist: false }),
        );
        assert.equal(doc.querySelectorAll('[data-ai-disclosure-filter-hidden]').length, 3);
        assert.equal(doc.querySelector('.sale_capsule [data-aif-badge]'), null);
        assert.ok(doc.querySelector('.app_name [data-aif-badge]'));
        controller.update(
            normalizeSettings({ mode: 'off', discoveryMode: 'custom', phrases: ['artwork'] }),
        );
        assert.equal(doc.querySelectorAll('[data-ai-disclosure-filter-hidden]').length, 2);
    } finally {
        controller.stop();
        dom.window.close();
    }
});
test('discovery defaults fail open, stale custom mode resets and unknown apps stay visible', () => {
    assert.equal(normalizeSettings({}).discoveryMode, 'off');
    assert.equal(normalizeSettings({}).preserveWishlist, true);
    assert.equal(normalizeSettings({ discoveryMode: 'custom:deleted' }).discoveryMode, 'off');
});

test('React hover metadata and legacy hover cache are decorated without artwork overlays', async () => {
    const dom = new JSDOM(
        `<div data-key="hover div"><a href="/app/10/"><div class="CapsuleImageCtn"><img></div></a></div><div id="global_hover_content"><div id="hover_app_11"><h4 class="hover_title">Legacy</h4></div></div>`,
        { url: 'https://store.steampowered.com/category/repeated' },
    );
    Object.assign(globalThis, { MutationObserver: dom.window.MutationObserver });
    const doc = dom.window.document;
    const tile = doc.querySelector<HTMLElement>('[data-key]')!;
    const controller = new FilterController(doc, {
        hasAIDisclosure: async () => true,
        getNotes: () => 'AI-generated artwork',
    });
    try {
        controller.update(normalizeSettings({}));
        await wait();
        assert.equal(tile.querySelector('[data-aif-badge]'), null);
        assert.ok(doc.querySelector('.hover_title [data-aif-badge]'));
        tile.insertAdjacentHTML(
            'afterbegin',
            '<div popover="manual"><a class="ReviewScore" href="/app/10/reviews">Positive</a></div>',
        );
        controller.scan();
        assert.ok(tile.querySelector('[popover] [data-aif-badge]'));
        tile.querySelector('[popover]')!.remove();
        controller.scan();
        assert.equal(tile.querySelector('[data-aif-badge]'), null);
        controller.update(normalizeSettings({ discoveryMode: 'hide', preserveWishlist: false }));
        assert.equal(
            doc.querySelector('#hover_app_11')!.hasAttribute('data-ai-disclosure-filter-hidden'),
            false,
        );
    } finally {
        controller.stop();
        dom.window.close();
    }
});

// Current homepage discount card and shared sale footer markup inspected Oct 22.
test('homepage discount cards and sale release bars show disclosed labels and use discovery mode', async () => {
    const dom = new JSDOM(
        `<div class="_229f53fK_tl7R6wqc-g2bq"><a class="_2V8zu-797jsZm1qtHNFXhS" href="/app/10/"><img alt="Disclosed game"><div class="_1-29ksrfQaORRCqN2AVf06">$9.99</div></a></div><div class="_229f53fK_tl7R6wqc-g2bq"><a href="/sale/event">Event promotion</a></div><div data-key="hover div"><a href="/app/11/"><div class="CapsuleImageCtn"><img></div><div class="CapsuleBottomBar">Coming soon</div></a></div><div class="LibraryAssetExpandedDisplay"><a href="/app/12/"><img></a><div class="_1_ehE8jTqsTDnx5E7Sqjy7"><span>Windows</span><div class="StoreSalePriceWidgetContainer">Available December</div></div></div>`,
        { url: 'https://store.steampowered.com/' },
    );
    Object.assign(globalThis, { MutationObserver: dom.window.MutationObserver });
    const doc = dom.window.document;
    const requests: number[] = [];
    const controller = new FilterController(doc, {
        hasAIDisclosure: async (id) => {
            requests.push(id);
            return true;
        },
        getNotes: () => 'AI-generated artwork',
    });
    try {
        controller.update(normalizeSettings({}));
        await wait();
        assert.deepEqual(requests, [10, 11, 12]);
        const home = doc.querySelector<HTMLElement>('._229f53fK_tl7R6wqc-g2bq')!;
        assert.ok(home.querySelector('._1-29ksrfQaORRCqN2AVf06>[data-aif-badge]'));
        const compact = doc.querySelector<HTMLElement>('[data-key]')!;
        assert.ok(compact.querySelector('.CapsuleBottomBar>[data-aif-badge]'));
        compact.insertAdjacentHTML(
            'afterbegin',
            '<div popover="manual"><div><a class="ReviewScore" href="/app/11/reviews">Positive</a></div></div>',
        );
        controller.scan();
        assert.equal(compact.querySelectorAll('[data-aif-badge]').length, 2);
        assert.ok(
            doc.querySelector(
                '.LibraryAssetExpandedDisplay ._1_ehE8jTqsTDnx5E7Sqjy7>[data-aif-badge]',
            ),
        );
        controller.update(normalizeSettings({ mode: 'hide', discoveryMode: 'off' }));
        assert.equal(home.hasAttribute('data-ai-disclosure-filter-hidden'), false);
        controller.update(normalizeSettings({ discoveryMode: 'hide' }));
        assert.equal(doc.querySelectorAll('[data-ai-disclosure-filter-hidden]').length, 3);
        controller.update(normalizeSettings({ discoveryMode: 'off' }));
        assert.equal(doc.querySelectorAll('[data-ai-disclosure-filter-hidden]').length, 0);
        assert.equal(requests.length, 3);
    } finally {
        controller.stop();
        assert.equal(doc.querySelectorAll('[data-aif-badge]').length, 0);
        dom.window.close();
    }
});

test('owned discovery exemption is opt-in, follows Steam flags and does not exempt search results', async () => {
    const dom = new JSDOM(
        `<div class="_229f53fK_tl7R6wqc-g2bq"><a href="/app/10/"><img><div class="_1-29ksrfQaORRCqN2AVf06">$9.99</div><span class="_1Ywwc4rP-p7ADlRoCRtVUb">In Library</span></a></div><div id="search_resultsRows"><a class="search_result_row ds_owned" href="/app/11/"><span class="title">Owned search game</span></a></div>`,
        { url: 'https://store.steampowered.com/' },
    );
    Object.assign(globalThis, { MutationObserver: dom.window.MutationObserver });
    const doc = dom.window.document;
    const controller = new FilterController(doc, {
        hasAIDisclosure: async () => true,
        getNotes: () => 'AI-generated artwork',
    });
    try {
        assert.equal(normalizeSettings({}).preserveOwned, false);
        controller.update(normalizeSettings({ mode: 'hide', discoveryMode: 'hide' }));
        await wait();
        assert.equal(doc.querySelectorAll('[data-ai-disclosure-filter-hidden]').length, 2);
        controller.update(
            normalizeSettings({ mode: 'hide', discoveryMode: 'hide', preserveOwned: true }),
        );
        assert.equal(doc.querySelectorAll('[data-ai-disclosure-filter-hidden]').length, 1);
        assert.equal(doc.querySelectorAll('[data-aif-badge]').length, 2);
        doc.querySelector('._1Ywwc4rP-p7ADlRoCRtVUb')!.className = '';
        await wait();
        assert.equal(doc.querySelectorAll('[data-ai-disclosure-filter-hidden]').length, 2);
    } finally {
        controller.stop();
        dom.window.close();
    }
});

test('sale recommendation anchors are discovered by the shared footer without duplicating expanded cards', () => {
    const dom = new JSDOM(
        `<a href="/app/91/"><img alt="Recommendation"><div class="_1_ehE8jTqsTDnx5E7Sqjy7">Available next month</div></a><div class="LibraryAssetExpandedDisplay"><a href="/app/92/"><img><div class="CapsuleBottomBar">Coming soon</div></a></div><a href="/sale/promotion"><img><div class="CapsuleBottomBar">Sale</div></a>`,
        { url: 'https://store.steampowered.com/sale/repeated' },
    );
    try {
        assert.deepEqual(
            detectStoreCards(dom.window.document)
                .map((c) => c.appId)
                .sort(),
            [91, 92],
        );
    } finally {
        dom.window.close();
    }
});

test('personalized legacy shelves use shared cards, price metadata and app-specific hover disclosures', async () => {
    const dom = new JSDOM(
        `<a class="store_capsule" href="/app/101/"><div class="capsule"><img></div><div><div class="discount_block">$10</div></div></a><a class="home_headercap" href="/app/102/"><img><div class="home_smallcap_title">Header</div></a><div class="community_recommendation_app"><a class="community_recommendation_capsule" href="/app/103/"><img></a><div class="right_col"><div class="app_name">Community</div></div></div><div id="global_hover_content"><div id="hover_app_101"><h4 class="hover_title">Generic</h4><div class="hover_review_summary">Positive</div></div><div id="hover_app_104"><h4 class="hover_title">No disclosure</h4></div></div>`,
        { url: 'https://store.steampowered.com/' },
    );
    Object.assign(globalThis, { MutationObserver: dom.window.MutationObserver });
    const doc = dom.window.document;
    const controller = new FilterController(doc, {
        hasAIDisclosure: async (id) => id !== 104,
        getNotes: () => 'AI-generated artwork',
    });
    try {
        controller.update(normalizeSettings({}));
        await wait();
        assert.deepEqual(
            detectStoreCards(doc).map((c) => c.appId),
            [101, 102, 103, 101, 104],
        );
        assert.equal(doc.querySelectorAll('[data-aif-badge]').length, 4);
        assert.ok(
            doc
                .querySelector('.store_capsule .discount_block')!
                .parentElement!.querySelector('[data-aif-badge]'),
        );
        assert.equal(doc.querySelector('.capsule [data-aif-badge]'), null);
        assert.ok(doc.querySelector('.home_smallcap_title [data-aif-badge]'));
        assert.ok(doc.querySelector('.app_name [data-aif-badge]'));
        assert.ok(doc.querySelector('#hover_app_101 .hover_review_summary [data-aif-badge]'));
        assert.equal(doc.querySelector('#hover_app_104 [data-aif-badge]'), null);
        controller.update(normalizeSettings({ discoveryMode: 'hide', preserveWishlist: false }));
        assert.equal(doc.querySelectorAll('[data-ai-disclosure-filter-hidden]').length, 3);
    } finally {
        controller.stop();
        dom.window.close();
    }
});
