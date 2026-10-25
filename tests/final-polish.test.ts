import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { detectStoreCards, isWishlisted } from '../webview/steam/surfaces';
import { FilterController } from '../webview/filtering/controller';
import { StorePageDisclosure } from '../webview/ui/storePage';
import { normalizeSettings } from '../shared/settings';
import { reconcilePolicy } from '../webview/config';
import { SlotPresentation } from '../webview/ui/slots';
const wait = () => new Promise((resolve) => setTimeout(resolve, 180));
const image = (id: number) =>
    `<img src="https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/hash/library_600x900.jpg">`;
const notes = 'We use AI to voice game characters.';

test('a nested wishlist shelf does not exempt the rest of the homepage', () => {
    const dom = new JSDOM(
        `<main class="home_page_content"><section class="SaleSectionCtn"><h2>On Your Wishlist</h2><a id="wishlist" href="/app/1/">Wishlist</a></section><section><h2>Your Personal Calendar</h2><a id="calendar" href="/app/2/">Calendar</a></section></main>`,
    );
    try {
        assert.equal(
            isWishlisted(dom.window.document.querySelector<HTMLElement>('#wishlist')!),
            true,
        );
        assert.equal(
            isWishlisted(dom.window.document.querySelector<HTMLElement>('#calendar')!),
            false,
        );
    } finally {
        dom.window.close();
    }
});

test('shared app artwork identifies new calendar cards, avoids duplicate adapters and removes wrappers', async () => {
    const dom = new JSDOM(
        `<main class="home_page_content"><section><h2>On Your Wishlist</h2></section><div class="calendar-grid"><div class="calendar-cell"><a href="/app/4094350/Online_404/">${image(4094350)}</a></div><div><a class="sale_capsule" href="/app/4435490/">${image(4435490)}</a></div><div><a href="/app/2/">${image(999)}</a></div></div><nav><a href="/app/3/">${image(3)}</a></nav></main>`,
        { url: 'https://store.steampowered.com/' },
    );
    Object.assign(globalThis, { MutationObserver: dom.window.MutationObserver });
    const doc = dom.window.document;
    assert.deepEqual(
        detectStoreCards(doc)
            .map((c) => c.appId)
            .sort(),
        [4094350, 4435490],
    );
    const requested: number[] = [];
    const ui = new FilterController(doc, {
        hasAIDisclosure: async (id) => {
            requested.push(id);
            return true;
        },
        getNotes: () => notes,
    });
    try {
        ui.update(normalizeSettings({ discoveryMode: 'hide' }));
        await wait();
        assert.equal(doc.querySelectorAll('[data-ai-disclosure-filter-hidden]').length, 2);
        assert.equal(
            dom.window.getComputedStyle(doc.querySelector('.calendar-cell')!).display,
            'none',
        );
        assert.equal(requested.length, 2);
        doc.querySelector('.calendar-grid')!.insertAdjacentHTML(
            'beforeend',
            `<div><a href="/app/4/">${image(4)}</a></div>`,
        );
        await wait();
        assert.equal(requested.length, 3);
        ui.update(normalizeSettings({ discoveryMode: 'off' }));
        assert.equal(doc.querySelector('[data-aif-slot-hidden]'), null);
        assert.equal(doc.querySelector('[data-ai-disclosure-filter-hidden]'), null);
    } finally {
        ui.stop();
        dom.window.close();
    }
});

function appPage(disclosed = true) {
    return new JSDOM(
        `<head><link rel="canonical" href="https://store.steampowered.com/app/216150/MapleStory/"></head><body><div id="appHubAppName">MapleStory</div><div id="glanceMidCtn"><div class="user_reviews">Reviews</div><div>Developer</div></div><div id="game_area_description"><h2>About This Game</h2></div><div id="game_area_content_descriptors"><h2>Mature Content Description</h2><i>Mature themes</i></div>${disclosed ? `<div id="game_area_content_descriptors"><h2>AI Generated Content Disclosure</h2><i>${notes}</i></div>` : ''}</body>`,
        { url: 'https://store.steampowered.com/app/216150/MapleStory/' },
    );
}

test('game page indicator uses its own official disclosure, preserves expansion and needs no lookup', () => {
    const dom = appPage();
    Object.assign(globalThis, { MutationObserver: dom.window.MutationObserver });
    const doc = dom.window.document;
    let requests = 0;
    const ui = new StorePageDisclosure(doc, {
        hasAIDisclosure: async () => {
            requests++;
            return false;
        },
    });
    try {
        ui.update();
        const row = doc.querySelector<HTMLDetailsElement>('[data-aif-store-disclosure]')!;
        assert.ok(row);
        assert.equal(row.querySelector('p')!.textContent, notes);
        assert.match(row.querySelector('summary')!.textContent!, /Generative AI disclosure/);
        assert.equal(requests, 0);
        row.open = true;
        ui.update();
        assert.equal(doc.querySelectorAll('[data-aif-store-disclosure]').length, 1);
        assert.equal(row.open, true);
        doc.querySelector('#glanceMidCtn')!.outerHTML =
            '<div id="glanceMidCtn">Replaced information card</div>';
        ui.update();
        assert.ok(doc.querySelector('#glanceMidCtn [data-aif-store-disclosure]'));
    } finally {
        ui.stop();
        assert.equal(doc.querySelector('[data-aif-store-disclosure]'), null);
        dom.window.close();
    }
});

test('undisclosed, mismatched and age-check pages receive no game-page indicator', () => {
    const dom = appPage(false);
    Object.assign(globalThis, { MutationObserver: dom.window.MutationObserver });
    const doc = dom.window.document;
    let requests = 0;
    const ui = new StorePageDisclosure(doc, {
        hasAIDisclosure: async () => {
            requests++;
            return true;
        },
    });
    try {
        ui.update();
        assert.equal(doc.querySelector('[data-aif-store-disclosure]'), null);
        doc.querySelector('link')!.href = 'https://store.steampowered.com/app/999/';
        ui.update();
        dom.window.history.pushState({}, '', '/agecheck/app/216150/');
        ui.update();
        assert.equal(requests, 0);
        assert.equal(doc.querySelector('[data-aif-store-disclosure]'), null);
    } finally {
        ui.stop();
        dom.window.close();
    }
});

test('visual preferences default on, propagate to open views and do not change filtering', async () => {
    assert.equal(normalizeSettings({}).showAITags, true);
    assert.equal(normalizeSettings({}).showStoreDisclosure, true);
    const next = reconcilePolicy(
        { defaultMode: 'off', mode: 'light' },
        { defaultMode: 'off', showAITags: false, showStoreDisclosure: false },
    )!;
    assert.equal(next.mode, 'light');
    assert.equal(next.showAITags, false);
    assert.equal(next.showStoreDisclosure, false);
    const dom = new JSDOM(
        '<a class="search_result_row" href="/app/1/"><div class="search_name"><span class="title">Disclosed</span></div></a><div id="global_hover_content"><div id="hover_app_1"><div class="hover_title">Disclosed</div></div></div>',
        { url: 'https://store.steampowered.com/search/' },
    );
    Object.assign(globalThis, { MutationObserver: dom.window.MutationObserver });
    const doc = dom.window.document;
    let requests = 0;
    const ui = new FilterController(doc, {
        hasAIDisclosure: async () => {
            requests++;
            return true;
        },
        getNotes: () => notes,
    });
    try {
        ui.update(normalizeSettings({ mode: 'hide', showAITags: false }));
        await wait();
        assert.equal(doc.querySelectorAll('[data-ai-disclosure-filter-hidden]').length, 1);
        assert.equal(doc.querySelector('[data-aif-badge]'), null);
        ui.update(normalizeSettings({ mode: 'hide', showAITags: true }));
        assert.equal(doc.querySelectorAll('[data-ai-disclosure-filter-hidden]').length, 1);
        assert.equal(doc.querySelectorAll('[data-aif-badge]').length, 2);
        assert.equal(requests, 1);
        ui.update(normalizeSettings({ mode: 'off', showAITags: false }));
        assert.equal(doc.querySelector('[data-ai-disclosure-filter-hidden]'), null);
        assert.equal(doc.querySelector('[data-aif-badge]'), null);
    } finally {
        ui.stop();
        dom.window.close();
    }
});

test('game-page section and its classification tag can be disabled independently', () => {
    const dom = appPage();
    Object.assign(globalThis, { MutationObserver: dom.window.MutationObserver });
    const doc = dom.window.document;
    const ui = new StorePageDisclosure(doc, { hasAIDisclosure: async () => true });
    try {
        ui.update({ showAITags: false, showStoreDisclosure: true });
        const row = doc.querySelector<HTMLDetailsElement>('[data-aif-store-disclosure]')!;
        assert.ok(row);
        assert.equal(row.querySelector('span')!.style.display, 'none');
        assert.equal(row.querySelector('p')!.textContent, notes);
        row.open = true;
        ui.update({ showAITags: true, showStoreDisclosure: true });
        assert.equal(row.open, true);
        assert.notEqual(row.querySelector('span')!.style.display, 'none');
        ui.update({ showAITags: true, showStoreDisclosure: false });
        assert.equal(doc.querySelector('[data-aif-store-disclosure]'), null);
        ui.update({ showAITags: true, showStoreDisclosure: true });
        assert.equal(doc.querySelectorAll('[data-aif-store-disclosure]').length, 1);
    } finally {
        ui.stop();
        dom.window.close();
    }
});

test('fixed category feature rows get one reversible replacement while Steam navigation stays intact', () => {
    const dom = new JSDOM(
        '<div class="VideoRow"><button>Previous</button><div class="_3hxg83PMgvZaOaB_-m0mXX" data-ai-disclosure-filter-hidden="true"><a href="/app/1/">Blocked feature</a></div><button>Next</button></div>',
    );
    const doc = dom.window.document,
        card = doc.querySelector<HTMLElement>('._3hxg83PMgvZaOaB_-m0mXX')!,
        buttons = [...doc.querySelectorAll('button')],
        ui = new SlotPresentation(doc);
    try {
        ui.update();
        ui.update();
        assert.equal(doc.querySelectorAll('[data-aif-hidden-feature]').length, 1);
        assert.match(
            doc.querySelector('[data-aif-hidden-feature]')!.textContent!,
            /Hidden by AI filter.*Discovery filter settings/,
        );
        assert.deepEqual([...doc.querySelectorAll('button')], buttons);
        assert.equal(card.isConnected, true);
        card.removeAttribute('data-ai-disclosure-filter-hidden');
        ui.update();
        assert.equal(doc.querySelector('[data-aif-hidden-feature]'), null);
        card.setAttribute('data-ai-disclosure-filter-hidden', 'true');
        ui.update();
        card.remove();
        ui.update();
        assert.equal(doc.querySelector('[data-aif-hidden-feature]'), null);
    } finally {
        ui.stop();
        assert.equal(doc.querySelector('[data-aif-hidden-feature]'), null);
        dom.window.close();
    }
});

test('fully blocked scrolling panels retain their indexed slots and show replacements without dots', async () => {
    const dom = new JSDOM(
        '<div class="carousel"><div class="carousel__slider-tray" style="width:200%;transform:translateX(-50%)"><div class="carousel__slide" style="width:50%;padding-bottom:unset;height:unset"><div class="carousel__inner-slide" style="position:unset"><div class="SaleSectionContainer"><div><a class="sale_capsule" href="/app/1/">Blocked</a></div><div><a class="sale_capsule" href="/app/2/">Blocked</a></div></div></div></div><div class="carousel__slide" style="width:50%"><a class="sale_capsule" href="/app/3/">Allowed</a></div></div><button>Previous</button><button>Next</button></div>',
        { url: 'https://store.steampowered.com/category/rpg/' },
    );
    Object.assign(globalThis, { MutationObserver: dom.window.MutationObserver });
    const doc = dom.window.document,
        tray = doc.querySelector<HTMLElement>('.carousel__slider-tray')!,
        slides = [...doc.querySelectorAll<HTMLElement>('.carousel__slide')],
        before = tray.getAttribute('style');
    const ui = new FilterController(doc, {
        hasAIDisclosure: async (id) => id !== 3,
        getNotes: () => notes,
    });
    try {
        ui.update(normalizeSettings({ discoveryMode: 'hide' }));
        await wait();
        assert.equal(doc.querySelectorAll('[data-aif-hidden-feature=slide]').length, 1);
        assert.ok(slides[0].querySelector(':scope > [data-aif-hidden-feature=slide]'));
        assert.equal(slides[1].querySelector('[data-aif-hidden-feature]'), null);
        assert.equal(tray.getAttribute('style'), before);
        assert.deepEqual([...tray.children], slides);
        assert.notEqual(dom.window.getComputedStyle(slides[0]).display, 'none');
        ui.scan();
        assert.equal(doc.querySelectorAll('[data-aif-hidden-feature]').length, 1);
        ui.update(normalizeSettings({ discoveryMode: 'hide', allowedApps: [1] }));
        assert.equal(doc.querySelector('[data-aif-hidden-feature]'), null);
        ui.update(normalizeSettings({ discoveryMode: 'hide' }));
        assert.ok(doc.querySelector('[data-aif-hidden-feature]'));
        ui.update(normalizeSettings({ discoveryMode: 'off' }));
        assert.equal(doc.querySelector('[data-aif-hidden-feature]'), null);
        assert.equal(doc.querySelector('[data-aif-slot-hidden]'), null);
    } finally {
        ui.stop();
        dom.window.close();
    }
});

test('mixed and promotion panels are never replaced, while fixed-height slots preserve their geometry', () => {
    const dom = new JSDOM(
        '<div class="carousel__slide" id="mixed"><a href="/app/1/" data-ai-disclosure-filter-hidden="true">Blocked</a><a href="/app/2/">Unknown</a></div><div class="carousel__slide" id="promotion"><a href="/app/1/" data-ai-disclosure-filter-hidden="true">Blocked</a><a href="/sale/event">Promotion</a></div><div class="carousel__slide" id="fixed" style="position:relative;width:30%;padding-bottom:25%"><div class="carousel__inner-slide" style="position:absolute"><a href="/app/1/" data-ai-disclosure-filter-hidden="true">Blocked</a></div></div>',
    );
    const doc = dom.window.document,
        ui = new SlotPresentation(doc),
        slot = doc.querySelector('#fixed')!,
        before = slot.getAttribute('style');
    try {
        ui.update();
        assert.equal(doc.querySelectorAll('[data-aif-hidden-feature]').length, 1);
        assert.ok(slot.querySelector('[data-aif-replacement-overlay]'));
        assert.equal(slot.getAttribute('style'), before);
        doc.querySelector('#fixed a')!.removeAttribute('data-ai-disclosure-filter-hidden');
        ui.update();
        assert.equal(doc.querySelector('[data-aif-hidden-feature]'), null);
    } finally {
        ui.stop();
        dom.window.close();
    }
});

test('wrapped category features mount replacements outside hidden wrappers and recover after replacement removal', () => {
    const dom = new JSDOM(
        '<div class="VideoRow"><button>Previous</button><div class="feature-wrapper"><div class="_3hxg83PMgvZaOaB_-m0mXX" data-ai-disclosure-filter-hidden="true"><a href="/app/1/">Blocked</a></div></div><button>Next</button></div>',
    );
    const doc = dom.window.document,
        wrapper = doc.querySelector('.feature-wrapper')!,
        ui = new SlotPresentation(doc);
    try {
        ui.update();
        assert.ok(wrapper.hasAttribute('data-aif-slot-hidden'));
        assert.equal(
            doc.querySelector('[data-aif-hidden-feature]')!.parentElement,
            doc.querySelector('.VideoRow'),
        );
        doc.querySelector('[data-aif-hidden-feature]')!.remove();
        ui.update();
        assert.equal(doc.querySelectorAll('[data-aif-hidden-feature]').length, 1);
        doc.querySelector('[data-ai-disclosure-filter-hidden]')!.removeAttribute(
            'data-ai-disclosure-filter-hidden',
        );
        ui.update();
        assert.equal(doc.querySelector('[data-aif-hidden-feature]'), null);
        assert.equal(wrapper.hasAttribute('data-aif-slot-hidden'), false);
    } finally {
        ui.stop();
        dom.window.close();
    }
});
