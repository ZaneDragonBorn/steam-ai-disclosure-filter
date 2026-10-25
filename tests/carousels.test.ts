import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { CarouselPresentation } from '../webview/ui/carousels';
const marker = 'data-ai-disclosure-filter-hidden';
function fixture() {
    return new JSDOM(
        `<div id="home_maincap_v7"><div class="carousel_container maincap"><div class="carousel_items"><a class="store_main_capsule focus" href="/app/1/">First</a><a class="store_main_capsule" href="/app/2/">Second</a><a class="store_main_capsule" href="/app/3/">Third</a></div><div class="carousel_thumbs"><div></div><div></div><div></div></div><button class="arrow right">Next</button></div></div>`,
        { url: 'https://store.steampowered.com/' },
    );
}
test('filtering the focused featured card advances through Steam, preserves indices and restores dots', () => {
    const dom = fixture(),
        doc = dom.window.document;
    const root = doc.querySelector<HTMLElement>('.carousel_container')!;
    const items = [...doc.querySelectorAll<HTMLElement>('.store_main_capsule')];
    let advances = 0,
        nearby = 0;
    const native = {
        $elContainer: { 0: doc.querySelector('#home_maincap_v7') },
        Advance: () => {
            advances++;
            items.forEach((e) => e.classList.remove('focus'));
            items.find((e) => !e.hasAttribute(marker))?.classList.add('focus');
        },
        UpdateNearbyItems: () => nearby++,
        UpdateControls: () => {},
    };
    (dom.window as any).GHomepage = { MainCapCarousel: native };
    const ui = new CarouselPresentation(doc);
    try {
        items[0].setAttribute(marker, 'true');
        items[1].setAttribute(marker, 'true');
        ui.update();
        assert.equal(advances, 1);
        assert.equal(items[2].classList.contains('focus'), true);
        assert.equal(doc.querySelectorAll('[data-aif-carousel-skip]').length, 2);
        assert.deepEqual([...doc.querySelector('.carousel_items')!.children], items);
        ui.update();
        assert.equal(advances, 1);
        items[0].removeAttribute(marker);
        ui.update();
        assert.equal(doc.querySelectorAll('[data-aif-carousel-skip]').length, 1);
        assert.ok(nearby > 0);
        items.forEach((e) => e.setAttribute(marker, 'true'));
        ui.update();
        assert.equal(root.hasAttribute('data-aif-carousel-empty'), true);
        assert.equal(dom.window.getComputedStyle(root).display, 'none');
        assert.equal(advances, 1);
        items.forEach((e) => e.removeAttribute(marker));
        ui.update();
        assert.equal(root.hasAttribute('data-aif-carousel-empty'), false);
        assert.equal(doc.querySelectorAll('[data-aif-carousel-skip]').length, 0);
    } finally {
        ui.stop();
        assert.equal(doc.querySelector('[data-aif-carousel-message]'), null);
        dom.window.close();
    }
});

test('missing Steam content restores stale markers and throwing helpers fail safely', () => {
    const dom = fixture(),
        doc = dom.window.document,
        root = doc.querySelector<HTMLElement>('.carousel_container')!;
    const item = doc.querySelector<HTMLElement>('.store_main_capsule')!;
    let attempts = 0,
        clicks = 0;
    (dom.window as any).GHomepage = {
        MainCapCarousel: {
            $elContainer: { 0: root },
            Advance: () => {
                attempts++;
                throw new Error('Steam changed');
            },
            UpdateNearbyItems: () => {
                throw new Error('Steam changed');
            },
        },
    };
    doc.querySelector('.arrow.right')!.addEventListener('click', () => clicks++);
    const ui = new CarouselPresentation(doc);
    try {
        item.setAttribute(marker, 'true');
        assert.doesNotThrow(() => ui.update());
        ui.update();
        assert.equal(attempts, 1);
        assert.equal(clicks, 1);
        doc.querySelector('.carousel_items')!.remove();
        ui.update();
        assert.equal(doc.querySelector('[data-aif-carousel-skip]'), null);
    } finally {
        assert.doesNotThrow(() => ui.stop());
        dom.window.close();
    }
});
test('isolated preload can use Steam’s native arrow handler without accessing page globals', () => {
    const dom = fixture(),
        doc = dom.window.document;
    const items = [...doc.querySelectorAll<HTMLElement>('.store_main_capsule')];
    let clicks = 0;
    doc.querySelector('.arrow.right')!.addEventListener('click', () => {
        clicks++;
        items[0].classList.remove('focus');
        items[1].classList.add('focus');
    });
    const ui = new CarouselPresentation(doc);
    try {
        items[0].setAttribute(marker, 'true');
        ui.update();
        ui.update();
        assert.equal(clicks, 1);
        assert.equal(items[1].classList.contains('focus'), true);
    } finally {
        ui.stop();
        dom.window.close();
    }
});

test('paged recommendation carousels skip only fully blocked pages and retain unresolved titles', () => {
    const dom = new JSDOM(
        `<div class="carousel_container paging_capsules"><div class="carousel_items"><div class="focus"><a class="sale_capsule" href="/app/1/">Blocked</a></div><div><a class="sale_capsule" href="/app/2/">Unknown</a><a class="sale_capsule" href="/app/3/">Blocked</a></div></div><div class="carousel_thumbs"><div></div><div></div></div><button class="arrow right">Next</button></div>`,
        { url: 'https://store.steampowered.com/' },
    );
    const doc = dom.window.document,
        pages = [...doc.querySelector('.carousel_items')!.children] as HTMLElement[];
    const apps = [...doc.querySelectorAll<HTMLElement>('.sale_capsule')];
    let advances = 0;
    doc.querySelector('.arrow.right')!.addEventListener('click', () => {
        advances++;
        pages[0].classList.remove('focus');
        pages[1].classList.add('focus');
    });
    const ui = new CarouselPresentation(doc);
    try {
        apps[0].setAttribute(marker, 'true');
        apps[2].setAttribute(marker, 'true');
        ui.update();
        assert.equal(advances, 1);
        assert.equal(pages[0].hasAttribute('data-aif-carousel-page-hidden'), true);
        assert.equal(pages[1].hasAttribute('data-aif-carousel-page-hidden'), false);
        assert.equal(doc.querySelectorAll('[data-aif-carousel-skip]').length, 1);
        apps[0].removeAttribute(marker);
        ui.update();
        assert.equal(pages[0].hasAttribute('data-aif-carousel-page-hidden'), false);
    } finally {
        ui.stop();
        assert.equal(doc.querySelector('[data-aif-carousel-page-hidden]'), null);
        dom.window.close();
    }
});
