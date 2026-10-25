import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyDisclosure } from '../shared/classification';
import {
    normalizeSettings,
    shouldHide,
    availablePresets,
    LIGHT_DESCRIPTION,
} from '../shared/settings';
import { JSDOM } from 'jsdom';
import { SidebarUI } from '../webview/ui/sidebar';
const assistance =
    'During the development process, we may use procedural- and AI-based tools to assist with content creation. In all such cases, the final product reflects the creativity and expression of our own development team.';
const finals =
    assistance +
    ' Examples include voiceover audio where we utilize text-to-speech tools to e.g. generate the audio of our in-game commentators Scotty & June.';
test('contextual disclosure categories distinguish scope, negation, and broad usage', () => {
    const cases: [string, string][] = [
        [assistance, 'light'],
        [finals, 'light'],
        ['Some game content was translated with the assistance of AI tools.', 'light'],
        ['AI concept art was not used in the final game.', 'light'],
        [
            'All voice lines were generated using AI narration tools. No live generation is used.',
            'audio',
        ],
        ['We did not use AI for artwork. We generate music using AI.', 'audio'],
        ['We use AI-generated textures and portraits. No AI voices are used.', 'visual'],
        ['We use AI to generate not only art but also music.', 'visual'],
        ['We use an LLM-powered chatbot to dynamically generate dialogue.', 'interactive'],
        ['Most artwork, writing and music in the game is generated using AI.', 'heavy'],
        ['All voice acting is AI-generated.', 'audio'],
        ['We use AI for translation. We also generate the story using AI.', 'visual'],
        ['All artwork is human-made. No runtime AI is used.', 'unclassified'],
        ['Our team uses AI tools to help develop some in-game content.', 'visual'],
    ];
    for (const [notes, key] of cases) assert.equal(classifyDisclosure(notes).key, key, notes);
    assert.deepEqual(classifyDisclosure(finals).categories, ['light', 'audio']);
    assert.doesNotMatch(LIGHT_DESCRIPTION, /ARC Raiders|THE FINALS/i);
    assert.equal(shouldHide(normalizeSettings({ mode: 'light' }), 2073850, true, finals), false);
    assert.equal(shouldHide(normalizeSettings({ mode: 'hide' }), 2073850, true, finals), true);
});

test('named custom filters support terms, category facets, ordering, and fail-open states', () => {
    const raw = {
        mode: 'custom:voices',
        customFilters: [
            { id: 'voices', name: 'Voices', categories: ['audio'], phrases: [], match: 'any' },
            {
                id: 'narration',
                name: 'Narration',
                categories: ['audio'],
                phrases: ['narrat'],
                match: 'all',
            },
        ],
    };
    const settings = normalizeSettings(raw);
    assert.equal(shouldHide(settings, 1, true, finals), true);
    assert.equal(shouldHide(settings, 1, null, finals), false);
    assert.equal(shouldHide({ ...settings, allowedApps: [1] }, 1, true, finals), false);
    assert.equal(
        shouldHide({ ...settings, mode: 'custom:narration' }, 1, true, 'AI-generated music'),
        false,
    );
    assert.equal(
        shouldHide({ ...settings, mode: 'custom:narration' }, 1, true, 'AI-generated narration'),
        true,
    );
    assert.deepEqual(
        availablePresets(settings)
            .slice(-2)
            .map((p) => p.label),
        ['Voices', 'Narration'],
    );
    assert.equal(normalizeSettings({ ...raw, customFilters: [] }).mode, 'off');
    assert.equal(
        normalizeSettings({
            customFilters: [
                { id: 'x', name: 'X', categories: ['invented'], phrases: ['test'] },
                { id: 'x', name: 'Duplicate' },
            ],
        }).customFilters!.length,
        1,
    );
});

test('storefront review is page-specific and search collapse uses the observed native animation', () => {
    const dom = new JSDOM('<aside id="additional_search_options"></aside>', {
        url: 'https://store.steampowered.com/search/',
    });
    const doc = dom.window.document;
    Object.assign(globalThis, { MutationObserver: dom.window.MutationObserver });
    const animations: string[] = [];
    (dom.window as any).$J = () => ({
        stop: () => {},
        slideUp: (speed: string, done: () => void) => {
            animations.push('up:' + speed);
            done();
        },
        slideDown: (speed: string) => animations.push('down:' + speed),
    });
    const ui = new SidebarUI(doc, async () => {});
    try {
        ui.update(normalizeSettings({ mode: 'hide', allowedApps: [1] }));
        ui.review(
            [{ appId: 2, title: 'Current game', notes: 'AI artwork', allowed: false }],
            1,
            5,
            false,
        );
        assert.equal(doc.querySelectorAll('article').length, 1);
        assert.match(doc.querySelector('article')!.textContent!, /Current game/);
        assert.doesNotMatch(doc.querySelector('article')!.textContent!, /unrelated/);
        assert.equal(doc.querySelector('h4')!.textContent, 'Blocked titles');
        assert.equal(doc.querySelector('.aif-exception-chip')!.textContent, 'App 1×');
        const toggle = doc.querySelector<HTMLButtonElement>('.aif-collapse')!;
        toggle.click();
        assert.equal(toggle.getAttribute('aria-expanded'), 'false');
        assert.equal(doc.querySelector<HTMLElement>('.aif-body')!.hidden, true);
        toggle.click();
        assert.deepEqual(animations, ['up:fast', 'down:fast']);
        assert.match(doc.querySelector('.aif-dot')!.getAttribute('title')!, /1 cards hidden/);
        ui.review([], 0, 0, false);
        assert.equal(doc.querySelectorAll('article').length, 0);
    } finally {
        ui.stop();
        dom.window.close();
    }
});

test('saved custom presets appear in storefront selectors and render a stable description', () => {
    const dom = new JSDOM('<aside id="additional_search_options"></aside>', {
        url: 'https://store.steampowered.com/search/',
    });
    Object.assign(globalThis, { MutationObserver: dom.window.MutationObserver });
    const ui = new SidebarUI(dom.window.document, async () => {});
    try {
        const settings = normalizeSettings({
            mode: 'custom:narration',
            customFilters: [
                {
                    id: 'narration',
                    name: 'No narration',
                    categories: ['audio'],
                    phrases: [],
                    match: 'any',
                },
            ],
        });
        ui.update(settings);
        assert.equal(
            dom.window.document.querySelector('.aif-current')!.textContent,
            'No narration',
        );
        assert.match(
            dom.window.document.querySelector('.aif-description')!.textContent!,
            /Configure in plugin settings/,
        );
        assert.equal(dom.window.document.querySelector('select'), null);
        assert.equal(
            dom.window.document.querySelector<HTMLInputElement>('input[type=range]')!.max,
            '4',
        );
    } finally {
        ui.stop();
        dom.window.close();
    }
});
