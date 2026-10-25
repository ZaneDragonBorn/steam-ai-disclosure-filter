import test from 'node:test';
import assert from 'node:assert/strict';
import { DisclosureCache } from '../webview/cache/disclosures';
import { SteamDisclosureProvider } from '../webview/steam/storeBrowse';
import { SteamHTMLProvider } from '../webview/steam/provider';
import { detectedApps } from '../shared/history';

test('stopping a cache settles queued callers and rejects late in-flight results', async () => {
    let calls = 0;
    let finish!: (value: boolean) => void;
    let signalStarted!: () => void;
    const started = new Promise<void>((resolve) => {
        signalStarted = resolve;
    });
    const provider = {
        hasAIDisclosure: () => {
            calls++;
            signalStarted();
            return new Promise<boolean>((done) => {
                finish = done;
            });
        },
    };
    const queued = new DisclosureCache(provider, () => true, Date.now, 100);
    const jobs = [queued.hasAIDisclosure(1), queued.hasAIDisclosure(2)];
    queued.stop();
    queued.stop();
    assert.deepEqual(await Promise.all(jobs), [null, null]);
    assert.equal(calls, 0);
    const active = new DisclosureCache(provider, () => true, Date.now, 0);
    const job = active.hasAIDisclosure(3);
    await started;
    active.stop();
    finish(true);
    assert.equal(await job, null);
    assert.equal(active.getNotes(3), undefined);
    assert.equal(await active.hasAIDisclosure(4), null);
    assert.equal(calls, 1);
});

test('cancelling structured fallback drains waiters without starting more requests', async () => {
    let calls = 0;
    const fallback = new SteamHTMLProvider();
    const finishes: (() => void)[] = [];
    fallback.hasAIDisclosure = async () => {
        calls++;
        await new Promise<void>((resolve) => finishes.push(resolve));
        return null;
    };
    const provider = new SteamDisclosureProvider(
        fallback,
        async () => new Response('', { status: 404 }),
    );
    const lookup = provider.hasAIDisclosures([1, 2, 3, 4, 5, 6, 7, 8]);
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(calls, 4);
    provider.cancel();
    finishes.forEach((resolve) => resolve());
    const results = await lookup;
    assert.equal(calls, 4);
    assert.equal(results.size, 8);
    assert.ok([...results.values()].every((value) => value === null));
    assert.equal(await provider.hasAIDisclosure(9), null);
});

test('cancelled HTML providers do not issue new HTTP requests', async () => {
    let calls = 0;
    const provider = new SteamHTMLProvider(async () => {
        calls++;
        return new Response('');
    });
    provider.cancel();
    assert.equal(await provider.hasAIDisclosure(1), null);
    assert.equal(calls, 0);
});

test('local history rejects invalid App IDs and clamps malformed review statistics', () => {
    const entry = {
        appId: 1,
        title: 'A',
        notes: 'Disclosure',
        allowed: false,
        reviewCount: NaN,
        percentPositive: 900,
    };
    const history = detectedApps([entry, { ...entry, appId: 4294967296 }, { ...entry, appId: -1 }]);
    assert.equal(history.length, 1);
    assert.equal(history[0].reviewCount, 0);
    assert.equal(history[0].percentPositive, 100);
});
