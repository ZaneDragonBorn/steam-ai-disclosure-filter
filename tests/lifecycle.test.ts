import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { managePageLifecycle } from '../webview/lifecycle';
import { StorePageDisclosure } from '../webview/ui/storePage';
import { FilterController } from '../webview/filtering/controller';
import { normalizeSettings } from '../shared/settings';
const wait = () => new Promise((resolve) => setTimeout(resolve, 180));

test('cached history restores remount the disclosure and observers once, using current preferences', async () => {
    const dom = new JSDOM(
        '<link rel="canonical" href="https://store.steampowered.com/app/4094350/Online_404/"><div id="appHubAppName">Online:404</div><div id="glanceMidCtn"></div><div id="game_area_description"><h2>About This Game</h2></div><div id="game_area_content_descriptors"><h2>AI Generated Content Disclosure</h2><i>We use AI to voice game characters.</i></div>',
        { url: 'https://store.steampowered.com/app/4094350/Online_404/' },
    );
    const win = dom.window,
        doc = win.document;
    Object.assign(globalThis, { MutationObserver: win.MutationObserver });
    let starts = 0,
        stops = 0,
        show = true;
    const dispose = managePageLifecycle(win as unknown as Window, () => {
        starts++;
        const ui = new StorePageDisclosure(doc, { hasAIDisclosure: async () => true });
        ui.update({ showAITags: false, showStoreDisclosure: show });
        return () => {
            stops++;
            ui.stop();
        };
    });
    const event = (type: string, persisted: boolean) =>
        win.dispatchEvent(new win.PageTransitionEvent(type, { persisted }));
    try {
        event('pageshow', false);
        assert.equal(starts, 1);
        assert.equal(doc.querySelectorAll('[data-aif-store-disclosure]').length, 1);
        for (let cycle = 0; cycle < 2; cycle++) {
            event('pagehide', true);
            assert.equal(doc.querySelector('[data-aif-store-disclosure]'), null);
            event('pageshow', true);
            event('pageshow', true);
            assert.equal(starts, cycle + 2);
            assert.equal(doc.querySelectorAll('[data-aif-store-disclosure]').length, 1);
            assert.equal(
                doc.querySelector<HTMLSpanElement>('[data-aif-store-disclosure] span')!.hidden,
                true,
            );
            doc.querySelector('#glanceMidCtn')!.outerHTML =
                '<div id="glanceMidCtn">Restored metadata</div>';
            await wait();
            assert.ok(doc.querySelector('#glanceMidCtn [data-aif-store-disclosure]'));
        }
        event('pagehide', true);
        show = false;
        event('pageshow', true);
        assert.equal(doc.querySelector('[data-aif-store-disclosure]'), null);
        assert.equal(starts, 4);
        assert.equal(stops, 3);
    } finally {
        dispose();
        assert.equal(stops, 4);
        assert.equal(doc.querySelector('[data-aif-store-disclosure]'), null);
        dom.window.close();
    }
});

test('history restore restarts list filtering and dynamic checks; final navigation disposes permanently', async () => {
    const dom = new JSDOM(
        '<a class="search_result_row" href="/app/1/"><div class="search_name"><span class="title">Disclosed</span></div></a>',
        { url: 'https://store.steampowered.com/search/' },
    );
    const win = dom.window,
        doc = win.document;
    Object.assign(globalThis, { MutationObserver: win.MutationObserver });
    let starts = 0,
        stops = 0;
    const dispose = managePageLifecycle(win as unknown as Window, () => {
        starts++;
        const ui = new FilterController(doc, {
            hasAIDisclosure: async () => true,
            getNotes: () => 'AI generated voices.',
        });
        ui.update(normalizeSettings({ mode: 'hide' }));
        return () => {
            stops++;
            ui.stop();
        };
    });
    const event = (type: string, persisted: boolean) =>
        win.dispatchEvent(new win.PageTransitionEvent(type, { persisted }));
    try {
        await wait();
        assert.equal(doc.querySelectorAll('[data-ai-disclosure-filter-hidden]').length, 1);
        event('pagehide', true);
        event('pagehide', true);
        assert.equal(stops, 1);
        assert.equal(doc.querySelector('[data-ai-disclosure-filter-hidden]'), null);
        event('pageshow', true);
        await wait();
        assert.equal(starts, 2);
        assert.equal(doc.querySelectorAll('[data-ai-disclosure-filter-hidden]').length, 1);
        doc.body.insertAdjacentHTML(
            'beforeend',
            '<a class="search_result_row" href="/app/2/">New result</a>',
        );
        await wait();
        await wait();
        assert.equal(doc.querySelectorAll('[data-ai-disclosure-filter-hidden]').length, 2);
        event('pagehide', false);
        assert.equal(stops, 2);
        assert.equal(doc.querySelector('[data-ai-disclosure-filter-hidden]'), null);
        event('pageshow', true);
        assert.equal(starts, 2);
        dispose();
        assert.equal(stops, 2);
    } finally {
        dispose();
        dom.window.close();
    }
});
