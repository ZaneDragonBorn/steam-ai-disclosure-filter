const POLICY_KEYS = [
    'defaultMode',
    'discoveryMode',
    'wishlistMode',
    'preserveWishlist',
    'preserveOwned',
    'showAITags',
    'showStoreDisclosure',
    'allowedApps',
    'phrases',
    'customFilters',
    'filterOrder',
    'debug',
] as const;
/** Reconcile a missed config broadcast without resetting a view's current slider.
 * Only a changed default changes that selection. History is never transported. */
export function reconcilePolicy(
    current: Record<string, unknown>,
    snapshot: Record<string, unknown>,
): Record<string, unknown> | null {
    if (!POLICY_KEYS.some((key) => JSON.stringify(current[key]) !== JSON.stringify(snapshot[key])))
        return null;
    const next = { ...current };
    for (const key of POLICY_KEYS) next[key] = snapshot[key];
    if (current.defaultMode !== snapshot.defaultMode) next.mode = snapshot.defaultMode ?? 'off';
    return next;
}
