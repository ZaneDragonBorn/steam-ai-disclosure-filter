import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { FilterController } from '../webview/filtering/controller';
import { normalizeSettings } from '../shared/settings';
import { parseStoreBrowse } from '../webview/steam/storeBrowse';
import { ReactCarouselPresentation } from '../webview/ui/reactCarousels';
import { reconcilePolicy } from '../webview/config';
import { SlotPresentation } from '../webview/ui/slots';
const pause = () => new Promise((resolve) => setTimeout(resolve, 170));
const notes = 'In-game AI character Ms. Second is using AI generated voice.';

test('missed config broadcasts reconcile policy without resetting a local slider or history', () => {
    const current = {
        defaultMode: 'custom',
        mode: 'light',
        discoveryMode: 'off',
        phrases: [],
        detectedApps: [{ appId: 1 }],
    };
    const policy = { defaultMode: 'custom', discoveryMode: 'hide', phrases: [] };
    const next = reconcilePolicy(current, policy)!;
    assert.equal(next.mode, 'light');
    assert.equal(next.discoveryMode, 'hide');
    assert.equal(next.detectedApps, current.detectedApps);
    assert.equal(reconcilePolicy(next, policy), null);
    assert.equal(reconcilePolicy(next, { ...policy, defaultMode: 'hide' })!.mode, 'hide');
    assert.equal(reconcilePolicy(next, { defaultMode: 'custom' })!.discoveryMode, undefined);
});

test('Active Matter official disclosure is blocked across shared cards; exemption and Show All restore layout', async () => {
    const dom = new JSDOM(
        `<div class="SaleSectionContainer"><div class="slot"><div class="ImpressionTrackedElement"><div data-key="hover div"><a href="/app/2887580/"><div class="CapsuleImageCtn"><img></div></a></div></div></div><div class="slot"><div data-key="hover div"><a href="/app/2/"><div class="CapsuleImageCtn"><img></div></a></div></div></div>`,
        { url: 'https://store.steampowered.com/category/action_fps' },
    );
    Object.assign(globalThis, { MutationObserver: dom.window.MutationObserver });
    const doc = dom.window.document;
    const payload = {
        response: {
            store_items: [
                {
                    id: 2887580,
                    appid: 2887580,
                    item_type: 0,
                    success: 1,
                    visible: true,
                    extra_details: { content_survey_ai_notes: notes },
                },
            ],
        },
    };
    assert.equal(parseStoreBrowse(payload, 2887580), true);
    const ui = new FilterController(doc, {
        hasAIDisclosure: async (id) => id === 2887580,
        getNotes: () => notes,
    });
    try {
        ui.update(normalizeSettings({ discoveryMode: 'hide' }));
        await pause();
        const slots = doc.querySelectorAll<HTMLElement>('.slot');
        assert.equal(dom.window.getComputedStyle(slots[0]).display, 'none');
        assert.notEqual(dom.window.getComputedStyle(slots[1]).display, 'none');
        ui.update(normalizeSettings({ discoveryMode: 'hide', allowedApps: [2887580] }));
        assert.notEqual(dom.window.getComputedStyle(slots[0]).display, 'none');
        ui.update(normalizeSettings({ discoveryMode: 'off' }));
        assert.equal(doc.querySelector('[data-aif-slot-hidden]'), null);
    } finally {
        ui.stop();
        assert.equal(doc.querySelector('[data-aif-slot-hidden]'), null);
        dom.window.close();
    }
});

test('portalled category hover popups use their own identity and clean up when recycled', async () => {
    const dom = new JSDOM(
        `<div popover="manual"><div class="_3WlfumeMCR40WR-uBdg3Gx"><a class="ReviewScore" href="/app/2887580/#app_reviews_hash">Positive</a></div></div>`,
        { url: 'https://store.steampowered.com/category/action_fps' },
    );
    Object.assign(globalThis, { MutationObserver: dom.window.MutationObserver });
    const doc = dom.window.document;
    const ui = new FilterController(doc, {
        hasAIDisclosure: async (id) => id === 2887580,
        getNotes: () => notes,
    });
    try {
        ui.update(normalizeSettings({ discoveryMode: 'hide' }));
        await pause();
        assert.equal(doc.querySelectorAll('[data-aif-badge]').length, 1);
        assert.equal(doc.querySelector('[data-ai-disclosure-filter-hidden]'), null);
        doc.querySelector('a')!.setAttribute('href', '/app/2/');
        ui.scan();
        await pause();
        assert.equal(doc.querySelector('[data-aif-badge]'), null);
    } finally {
        ui.stop();
        dom.window.close();
    }
});

test('fully blocked grid groups collapse but mixed sale promotions remain visible', async () => {
    const dom = new JSDOM(
        `<div class="SaleSectionContainer"><div class="slot"><a class="sale_capsule" href="/app/1/"><img></a></div></div><div class="SaleSectionContainer"><div class="slot"><a class="sale_capsule" href="/app/1/"><img></a><a href="/sale/promotion">Promotion</a></div></div>`,
        { url: 'https://store.steampowered.com/sale/anything' },
    );
    Object.assign(globalThis, { MutationObserver: dom.window.MutationObserver });
    const doc = dom.window.document;
    const groups = doc.querySelectorAll<HTMLElement>('.SaleSectionContainer');
    const ui = new FilterController(doc, {
        hasAIDisclosure: async () => true,
        getNotes: () => notes,
    });
    try {
        ui.update(normalizeSettings({ discoveryMode: 'hide' }));
        await pause();
        assert.equal(dom.window.getComputedStyle(groups[0]).display, 'none');
        assert.notEqual(dom.window.getComputedStyle(groups[1]).display, 'none');
        ui.update(normalizeSettings({ discoveryMode: 'off' }));
        assert.equal(doc.querySelector('[data-aif-slot-hidden]'), null);
    } finally {
        ui.stop();
        dom.window.close();
    }
});

test('React promotion carousel skips blocked pages through native dots without changing track geometry', () => {
    const dom = new JSDOM(
        `<div class="carousel"><div class="carousel__slider-tray" style="width:300%;transform:translateX(0%)"><div class="carousel__slide"><a href="/app/1/" data-ai-disclosure-filter-hidden="true">Blocked</a></div><div class="carousel__slide"><a href="/app/2/" data-ai-disclosure-filter-hidden="true">Blocked</a></div><div class="carousel__slide"><a href="/app/3/">Unknown</a></div></div><button class="carousel__dot carousel__dot--selected"></button><button class="carousel__dot"></button><button class="carousel__dot"></button></div>`,
        { url: 'https://store.steampowered.com/' },
    );
    const doc = dom.window.document,
        dots = [...doc.querySelectorAll<HTMLElement>('.carousel__dot')],
        tray = doc.querySelector<HTMLElement>('.carousel__slider-tray')!,
        before = tray.outerHTML;
    let clicks = 0;
    dots[2].addEventListener('click', () => {
        clicks++;
        dots[0].classList.remove('carousel__dot--selected');
        dots[2].classList.add('carousel__dot--selected');
    });
    const ui = new ReactCarouselPresentation(doc);
    try {
        ui.update();
        ui.update();
        assert.equal(clicks, 1);
        assert.equal(doc.querySelectorAll('[data-aif-carousel-skip]').length, 2);
        assert.equal(tray.outerHTML, before);
        doc.querySelectorAll('[data-ai-disclosure-filter-hidden]').forEach((e) =>
            e.removeAttribute('data-ai-disclosure-filter-hidden'),
        );
        ui.update();
        assert.equal(doc.querySelector('[data-aif-carousel-skip]'), null);
    } finally {
        ui.stop();
        dom.window.close();
    }
});

test('mixed-size Steam slide rows pack surviving cards without reparenting and restore native layout', () => {
    const dom = new JSDOM(
        `<div class="HlkukqE4fB5si76sBJzKX"><div class="SaleSectionContainer"><div><a href="/app/1/" data-ai-disclosure-filter-hidden="true">Blocked</a></div><div><a href="/app/2/">Allowed</a></div></div><div class="SaleSectionContainer"><div><a href="/app/3/">Allowed</a></div><div><a href="/app/4/">Allowed</a></div><div><a href="/app/5/">Allowed</a></div></div></div>`,
    );
    const doc = dom.window.document,
        page = doc.querySelector<HTMLElement>('.HlkukqE4fB5si76sBJzKX')!,
        rows = [...page.children],
        ui = new SlotPresentation(doc);
    try {
        ui.update();
        assert.equal(page.hasAttribute('data-aif-compact-grid'), true);
        assert.equal(dom.window.getComputedStyle(rows[0]).display, 'contents');
        assert.deepEqual([...page.children], rows);
        doc.querySelector('[data-ai-disclosure-filter-hidden]')!.removeAttribute(
            'data-ai-disclosure-filter-hidden',
        );
        ui.update();
        assert.equal(page.hasAttribute('data-aif-compact-grid'), false);
    } finally {
        ui.stop();
        dom.window.close();
    }
});
