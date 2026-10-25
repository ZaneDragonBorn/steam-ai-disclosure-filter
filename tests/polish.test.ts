import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { DisclosureBadges } from '../webview/ui/badges';
import { parseExceptionAppId, disclosureTier } from '../shared/settings';

test('manual exceptions accept only valid Steam App IDs', () => {
    assert.equal(parseExceptionAppId(' 1808500 '), 1808500);
    for (const value of ['', '0', '-1', '1.2', '1e6', 'app/620', '4294967296', 'hello'])
        assert.equal(parseExceptionAppId(value), null);
    assert.equal(parseExceptionAppId('4294967295'), 4294967295);
});

test('badges reuse Light Usage rules, remain unique, and safely clean recycled cards', () => {
    const dom = new JSDOM(
        '<a class="search_result_row" href="/app/1/"><span class="title">Game</span></a><div id="expanded" style="position:static"><img><div class="metadata"><a class="ReviewScore">Positive</a></div></div>',
    );
    const doc = dom.window.document;
    const row = doc.querySelector<HTMLElement>('a')!;
    const expanded = doc.querySelector<HTMLElement>('#expanded')!;
    const badges = new DisclosureBadges(doc);
    try {
        badges.update(row, 1, false, '');
        assert.equal(doc.querySelectorAll('[data-aif-badge]').length, 0);
        badges.update(row, 1, true, 'AI is used only for translation.');
        badges.update(row, 1, true, 'AI is used only for translation.');
        assert.equal(row.querySelectorAll('[data-aif-badge]').length, 1);
        assert.equal(row.querySelector('[data-aif-badge]')!.textContent, 'AI - Light');
        assert.match(
            row.querySelector<HTMLElement>('[data-aif-badge]')!.title,
            /translation|localization/,
        );
        badges.update(row, 2, true, 'AI-generated artwork <script>bad()</script>');
        assert.equal(row.querySelectorAll('[data-aif-badge]').length, 1);
        assert.equal(row.querySelectorAll('script').length, 0);
        assert.equal(row.querySelector('[data-aif-badge]')!.textContent, 'AI - Content');
        assert.match(
            row.querySelector<HTMLElement>('[data-aif-badge]')!.title,
            /disclosure does not establish/,
        );
        badges.update(row, 3, null, '');
        assert.equal(row.querySelectorAll('[data-aif-badge]').length, 0);
        badges.update(expanded, 2, true, 'Artwork');
        assert.equal(expanded.style.position, 'static');
        assert.equal(expanded.querySelectorAll('[data-aif-overlay]').length, 0);
        assert.equal(expanded.querySelectorAll('.metadata [data-aif-badge]').length, 1);
        badges.stop();
        assert.equal(doc.querySelectorAll('[data-aif-badge]').length, 0);
        assert.equal(expanded.style.position, 'static');
        assert.equal(disclosureTier('unrecognized disclosure').key, 'unclassified');
    } finally {
        badges.stop();
        dom.window.close();
    }
});
