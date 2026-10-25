import { classifyDisclosure, AICategory } from './classification';
export { classifyDisclosure as disclosureTier } from './classification';
export function parseExceptionAppId(value: string): number | null {
    if (!/^\d+$/.test(value.trim())) return null;
    const id = Number(value.trim());
    return Number.isSafeInteger(id) && id > 0 && id <= 0xffffffff ? id : null;
}
export type FilterMode = 'off' | 'light' | 'custom' | 'hide' | `custom:${string}`;
export interface CustomFilter {
    id: string;
    name: string;
    phrases: string[];
    categories: AICategory[];
    match: 'any' | 'all';
}
export interface Settings {
    mode: FilterMode;
    discoveryMode?: FilterMode;
    preserveWishlist?: boolean;
    preserveOwned?: boolean;
    showAITags?: boolean;
    showStoreDisclosure?: boolean;
    debug: boolean;
    phrases?: string[];
    allowedApps?: number[];
    customFilters?: CustomFilter[];
    filterOrder?: FilterMode[];
}
const categoryKeys = ['light', 'audio', 'visual', 'interactive', 'heavy', 'unclassified'];
function phrases(value: unknown): string[] {
    return Array.isArray(value)
        ? [
              ...new Set(
                  value
                      .filter((p): p is string => typeof p === 'string')
                      .map((p) => p.trim().slice(0, 120))
                      .filter(Boolean),
              ),
          ].slice(0, 30)
        : [];
}
export function normalizeSettings(raw: Record<string, unknown>): Settings {
    const customFilters: CustomFilter[] = [];
    if (Array.isArray(raw.customFilters))
        for (const item of raw.customFilters.slice(0, 30)) {
            if (
                !item ||
                typeof item !== 'object' ||
                typeof item.id !== 'string' ||
                !/^[a-zA-Z0-9_-]{1,64}$/.test(item.id) ||
                customFilters.some((f) => f.id === item.id)
            )
                continue;
            customFilters.push({
                id: item.id,
                name:
                    typeof item.name === 'string'
                        ? item.name.trim().slice(0, 60) || 'Custom filter'
                        : 'Custom filter',
                phrases: phrases(item.phrases),
                categories: Array.isArray(item.categories)
                    ? ([
                          ...new Set(
                              item.categories.filter(
                                  (c: unknown) => typeof c === 'string' && categoryKeys.includes(c),
                              ),
                          ),
                      ] as AICategory[])
                    : [],
                match: item.match === 'all' ? 'all' : 'any',
            });
        }
    const mode =
        raw.mode === 'hide' ||
        raw.mode === 'custom' ||
        raw.mode === 'light' ||
        customFilters.some((f) => raw.mode === `custom:${f.id}`)
            ? (raw.mode as FilterMode)
            : 'off';
    const discoveryMode =
        raw.discoveryMode === 'hide' ||
        raw.discoveryMode === 'custom' ||
        raw.discoveryMode === 'light' ||
        customFilters.some((f) => raw.discoveryMode === `custom:${f.id}`)
            ? (raw.discoveryMode as FilterMode)
            : 'off';
    return {
        mode,
        discoveryMode,
        preserveWishlist: raw.preserveWishlist !== false,
        preserveOwned: raw.preserveOwned === true,
        showAITags: raw.showAITags !== false,
        showStoreDisclosure: raw.showStoreDisclosure !== false,
        debug: raw.debug === true,
        phrases: phrases(raw.phrases),
        customFilters,
        filterOrder: Array.isArray(raw.filterOrder)
            ? [
                  ...new Set(
                      raw.filterOrder.filter(
                          (m): m is FilterMode =>
                              m === 'light' ||
                              m === 'custom' ||
                              m === 'hide' ||
                              customFilters.some((f) => m === `custom:${f.id}`),
                      ),
                  ),
              ]
            : [],
        allowedApps: Array.isArray(raw.allowedApps)
            ? [
                  ...new Set(
                      raw.allowedApps.filter(
                          (id): id is number =>
                              typeof id === 'number' &&
                              Number.isSafeInteger(id) &&
                              id > 0 &&
                              id <= 0xffffffff,
                      ),
                  ),
              ].slice(0, 500)
            : [],
    };
}
export function shouldHide(
    settings: Settings,
    appId: number,
    disclosed: boolean | null,
    notes = '',
): boolean {
    if (disclosed !== true || settings.allowedApps?.includes(appId)) return false;
    if (settings.mode === 'hide') return true;
    if (settings.mode === 'light') return !isLightDisclosure(notes);
    const lower = notes.toLocaleLowerCase();
    if (settings.mode === 'custom')
        return (settings.phrases ?? []).some((p) => lower.includes(p.toLocaleLowerCase()));
    const filter = settings.customFilters?.find((f) => settings.mode === `custom:${f.id}`);
    if (!filter) return false;
    const classification = classifyDisclosure(notes);
    const terms = filter.phrases.some((p) => lower.includes(p.toLocaleLowerCase()));
    const categories = filter.categories.some((c) => classification.categories.includes(c));
    return filter.match === 'all'
        ? (filter.phrases.length > 0 || filter.categories.length > 0) &&
              (!filter.phrases.length || terms) &&
              (!filter.categories.length || categories)
        : terms || categories;
}
export const PRESETS: { mode: FilterMode; label: string }[] = [
    { mode: 'off', label: 'Show All' },
    { mode: 'light', label: 'Light Usage' },
    { mode: 'custom', label: 'Custom' },
    { mode: 'hide', label: 'Hide Disclosed' },
];
export function availablePresets(settings: Settings) {
    const all = [
        ...PRESETS,
        ...(settings.customFilters ?? []).map((f) => ({
            mode: `custom:${f.id}` as FilterMode,
            label: f.name,
        })),
    ];
    const order = [...new Set(['off', ...(settings.filterOrder ?? []), ...all.map((p) => p.mode)])];
    return order.flatMap((mode) => all.filter((p) => p.mode === mode));
}
/** Reordering never moves Show All and ignores stale/deleted IDs. */
export function reorderPresets(
    settings: Settings,
    source: FilterMode,
    target: FilterMode,
): FilterMode[] {
    const order = availablePresets(settings).map((p) => p.mode);
    const from = order.indexOf(source),
        to = order.indexOf(target);
    if (from > 0 && to > 0 && from !== to) {
        order.splice(from, 1);
        order.splice(to, 0, source);
    }
    return order.filter((m) => m !== 'off');
}
export const LIGHT_DESCRIPTION =
    'Allow limited AI assistance, such as translation, localization, concept work, and narrowly scoped development assistance. Block other disclosed AI uses.';
export function presetDescription(mode: FilterMode): string {
    return (
        (
            {
                off: 'Show all games, including those with disclosed generative AI use.',
                light: LIGHT_DESCRIPTION,
                custom: 'Block games whose AI disclosure contains any of your saved phrases.',
                hide: 'Block all games with a generative AI disclosure.',
            } as Record<string, string>
        )[mode] ?? 'Block titles that match this filters rules. Configure in plugin settings.'
    );
}
export function isLightDisclosure(notes: string): boolean {
    return classifyDisclosure(notes).key === 'light';
}
