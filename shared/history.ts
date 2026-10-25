export interface ReviewedApp {
    appId: number;
    title: string;
    notes: string;
    allowed: boolean;
    hidden?: boolean;
    reviewCount?: number;
    percentPositive?: number;
}
/** Bounded, validated history received through Millennium configuration. */
export function detectedApps(value: unknown): ReviewedApp[] {
    if (!Array.isArray(value)) return [];
    return value
        .filter(
            (v): v is ReviewedApp =>
                !!v &&
                typeof v === 'object' &&
                Number.isSafeInteger(v.appId) &&
                v.appId > 0 &&
                v.appId <= 0xffffffff &&
                typeof v.title === 'string' &&
                typeof v.notes === 'string',
        )
        .slice(0, 300)
        .map((v) => ({
            ...v,
            title: v.title.slice(0, 200),
            notes: v.notes.slice(0, 10000),
            reviewCount:
                typeof v.reviewCount === 'number' && Number.isFinite(v.reviewCount)
                    ? Math.max(0, v.reviewCount)
                    : 0,
            percentPositive:
                typeof v.percentPositive === 'number' && Number.isFinite(v.percentPositive)
                    ? Math.max(0, Math.min(100, v.percentPositive))
                    : 0,
        }));
}
export function rankApps(apps: ReviewedApp[]): ReviewedApp[] {
    return [...apps].sort(
        (a, b) =>
            (b.reviewCount ?? 0) - (a.reviewCount ?? 0) ||
            (b.percentPositive ?? 0) - (a.percentPositive ?? 0) ||
            a.title.localeCompare(b.title),
    );
}
