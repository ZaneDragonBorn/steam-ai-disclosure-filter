import { pluginConfig, subscribePluginConfig } from 'millennium';
import { normalizeSettings } from '../shared/settings';
import { DisclosureCache } from './cache/disclosures';
import { FilterController } from './filtering/controller';
import { SteamDisclosureProvider } from './steam/storeBrowse';
import { isSupportedStore, filterHosts } from './steam/surfaces';
import { SidebarUI } from './ui/sidebar';
import { detectedApps } from '../shared/history';
import { reconcilePolicy } from './config';
import { appIdFromURL } from './steam/provider';
import { StorePageDisclosure } from './ui/storePage';
import { managePageLifecycle } from './lifecycle';

export default async function main() {
    if (location.origin !== 'https://store.steampowered.com') return;
    if (document.readyState === 'loading')
        await new Promise<void>((resolve) =>
            document.addEventListener('DOMContentLoaded', () => resolve(), { once: true }),
        );
    managePageLifecycle(window, startStoreView);
}

function startStoreView(): () => void {
    let raw: Record<string, unknown> = {};
    let stopped = false;
    let revision = 0;
    let historyTimer: ReturnType<typeof setTimeout> | undefined;
    let historySignature = '';
    let historyPending = '[]';
    let leaseTimer: ReturnType<typeof setTimeout> | undefined;
    const provider = new SteamDisclosureProvider();
    const cache = new DisclosureCache(
        provider,
        () => !stopped && (isSupportedStore(location.href) || appIdFromURL(location.href) !== null),
    );
    const storePage = new StorePageDisclosure(document, cache);
    let writes: Promise<void> = Promise.resolve();
    const sidebar = new SidebarUI(
        document,
        (patch) => {
            revision++; // A pending local save supersedes an older lease response.
            const task = writes
                .catch(() => {})
                .then(async () => {
                    if (stopped) throw new Error('Plugin stopped');
                    const validated = normalizeSettings({ ...raw, ...patch });
                    for (const key of Object.keys(patch) as (keyof typeof validated)[]) {
                        await pluginConfig.set(key, validated[key] as never);
                        raw[key] = validated[key];
                    }
                    revision++;
                    update();
                });
            writes = task;
            return task;
        },
        filterHosts,
        () => {
            void refreshFilters();
        },
    );
    const controller = new FilterController(
        document,
        cache,
        (apps, hidden, checked, checking, unresolved, history) => {
            sidebar.review(apps, hidden, checked, checking, unresolved);
            if (raw.debug === true)
                console.debug('[AI Filter] Listing status', {
                    hidden,
                    checked,
                    checking,
                    unresolved,
                });
            const next = JSON.stringify(history.slice(0, 300));
            if (next !== historySignature && history.length) {
                historySignature = next;
                historyPending = next;
                if (!historyTimer)
                    historyTimer = setTimeout(() => {
                        historyTimer = undefined;
                        void backend
                            .recordDetected(JSON.parse(historyPending))
                            .catch((error) =>
                                console.warn('[AI Filter] Could not save review history', error),
                            );
                    }, 750);
            }
        },
    );
    const update = () => {
        if (stopped) return;
        const settings = normalizeSettings(raw);
        sidebar.update(settings);
        sidebar.history(detectedApps(raw.detectedApps));
        controller.update(settings);
        storePage.update(settings);
    };
    const refreshFilters = async () => {
        const before = revision;
        try {
            const latest = await pluginConfig.getAll<Record<string, unknown>>();
            if (stopped) return;
            raw = before === revision ? latest : { ...latest, ...raw };
            raw.mode = raw.mode ?? raw.defaultMode ?? 'off';
            update();
        } catch (error) {
            console.warn('[AI Filter] Could not refresh filters', error);
        }
    };
    const unsubscribe = subscribePluginConfig((key, value) => {
        if (stopped) return;
        revision++;
        raw[key] = value;
        if (key === 'defaultMode') raw.mode = value;
        if (key === 'detectedApps') sidebar.history(detectedApps(value));
        else update();
    });
    const stop = () => {
        if (stopped) return;
        stopped = true;
        unsubscribe();
        cache.stop();
        provider.cancel();
        controller.stop();
        sidebar.stop();
        storePage.stop();
        clearTimeout(historyTimer);
        clearTimeout(leaseTimer);
        window.removeEventListener('popstate', update);
    };
    window.addEventListener('popstate', update);
    // Webkit does not document a plugin-unload callback. An FFI lease fails open
    // when the backend disappears; disable restores cards within ~7 seconds.
    const checkLease = async () => {
        let timeout: ReturnType<typeof setTimeout> | undefined;
        const before = revision;
        try {
            const snapshot = await Promise.race([
                backend.filterState(),
                new Promise<never>((_, reject) => {
                    timeout = setTimeout(() => reject(new Error('Backend unavailable')), 4000);
                }),
            ]);
            if (
                !stopped &&
                before === revision &&
                snapshot &&
                typeof snapshot === 'object' &&
                !Array.isArray(snapshot)
            ) {
                const next = reconcilePolicy(raw, snapshot);
                if (next) {
                    raw = next;
                    revision++;
                    update();
                }
            }
            if (!stopped)
                leaseTimer = setTimeout(() => {
                    void checkLease();
                }, 3000);
        } catch {
            stop();
        } finally {
            clearTimeout(timeout);
        }
    };
    const initialize = async () => {
        try {
            const before = revision;
            const initial = await pluginConfig.getAll<Record<string, unknown>>();
            if (stopped) return;
            raw = before === revision ? initial : { ...initial, ...raw };
            raw.mode = raw.defaultMode ?? raw.mode ?? 'off';
            update();
            console.info(
                '[AI Filter] Store preload ready; controls are in the storefront filter sidebar',
            );
            void checkLease();
        } catch (error) {
            console.warn('[AI Filter] Settings unavailable; leaving games visible', error);
            stop();
        }
    };
    void initialize();
    return stop;
}
