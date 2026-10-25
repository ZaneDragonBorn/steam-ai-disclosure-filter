import {
    DialogCheckbox,
    Field,
    Dropdown,
    DialogButton,
    DialogBodyText,
    TextField,
    Focusable,
    usePluginConfig,
} from 'millennium';
import { useState, useRef, useEffect } from 'react';
import { FilterOrderDrag } from './ordering';
import {
    availablePresets,
    normalizeSettings,
    presetDescription,
    parseExceptionAppId,
    CustomFilter,
    reorderPresets,
    FilterMode,
} from '../shared/settings';
import { AI_CATEGORIES } from '../shared/classification';
import { detectedApps } from '../shared/history';
import { FilterEditor } from './editor';
import { stack, section, SettingsSection } from './ui';
export function SettingsContent() {
    const [mode, setMode] = usePluginConfig<string>('defaultMode');
    const [allowed, setAllowed] = usePluginConfig<number[]>('allowedApps');
    const [discoveryMode, setDiscoveryMode] = usePluginConfig<string>('discoveryMode');
    const [preserveWishlist, setPreserveWishlist] = usePluginConfig<boolean>('preserveWishlist');
    const [preserveOwned, setPreserveOwned] = usePluginConfig<boolean>('preserveOwned');
    const [showAITags, setShowAITags] = usePluginConfig<boolean>('showAITags');
    const [showStoreDisclosure, setShowStoreDisclosure] =
        usePluginConfig<boolean>('showStoreDisclosure');
    const [phrases, setPhrases] = usePluginConfig<string[]>('phrases');
    const [phraseDraft, setPhraseDraft] = useState('');
    useEffect(() => setPhraseDraft((phrases ?? []).join('; ')), [JSON.stringify(phrases)]);
    const [history] = usePluginConfig<unknown>('detectedApps');
    const [filterOrder, setFilterOrder] = usePluginConfig<FilterMode[]>('filterOrder');
    const [customFilters, setCustomFilters] = usePluginConfig<unknown>('customFilters');
    const [error, setError] = useState('');
    const [appId, setAppId] = useState('');
    const [editing, setEditing] = useState<CustomFilter | null>(null);
    const settings = normalizeSettings({
        mode,
        discoveryMode,
        preserveWishlist,
        preserveOwned,
        showAITags,
        showStoreDisclosure,
        phrases,
        allowedApps: allowed,
        customFilters,
        filterOrder,
    });
    const filters = settings.customFilters ?? [];
    const presets = availablePresets(settings);
    const knownApps = new Map(detectedApps(history).map((app) => [app.appId, app]));
    const [dragging, setDragging] = useState<FilterMode | null>(null);
    const [dropTarget, setDropTarget] = useState<FilterMode | null>(null);
    const reorder = (source: FilterMode, target: FilterMode) =>
        save(setFilterOrder(reorderPresets(settings, source, target)));
    const drag = useRef<FilterOrderDrag | null>(null);
    if (!drag.current) drag.current = new FilterOrderDrag();
    drag.current.onDrop = reorder;
    drag.current.onFeedback = (source, target) => {
        setDragging(source);
        setDropTarget(target);
    };
    useEffect(
        () => () => {
            if (drag.current) {
                drag.current.onFeedback = () => {};
                drag.current.cancel();
            }
        },
        [],
    );
    const save = (task: Promise<void>) => {
        setError('');
        void task.catch(() => setError('Could not save. Please retry.'));
    };
    const saveFilters = async (next: CustomFilter[]) => {
        const normalized = normalizeSettings({ customFilters: next }).customFilters ?? [];
        await setCustomFilters(normalized);
        if (mode?.startsWith('custom:') && !normalized.some((f) => mode === `custom:${f.id}`))
            await setMode('off');
        if (
            discoveryMode?.startsWith('custom:') &&
            !normalized.some((f) => discoveryMode === `custom:${f.id}`)
        )
            await setDiscoveryMode('off');
    };
    const add = async () => {
        const id = parseExceptionAppId(appId);
        if (id === null) {
            setError('Enter a valid numeric Steam App ID.');
            return;
        }
        if (!settings.allowedApps?.includes(id) && (settings.allowedApps?.length ?? 0) >= 500) {
            setError('Remove an exemption before adding another.');
            return;
        }
        setError('');
        try {
            await setAllowed([...new Set([...(settings.allowedApps ?? []), id])]);
            setAppId('');
        } catch {
            setError('Could not save the exemption.');
        }
    };
    return (
        <>
            <section aria-label="Storefront AI filter" style={section}>
                <Field
                    label="Default AI Filter"
                    description="Choose the filter applied when you open a storefront page. Changes also apply to open pages."
                    childrenLayout="below"
                    childrenContainerWidth="max"
                >
                    <div style={stack}>
                        <Dropdown
                            rgOptions={presets.map((p) => ({ data: p.mode, label: p.label }))}
                            selectedOption={settings.mode}
                            onChange={(o) => save(setMode(o.data))}
                        />
                        <DialogBodyText
                            style={{ fontSize: 13, lineHeight: 1.5, margin: '8px 0 0' }}
                        >
                            {presetDescription(settings.mode)}
                        </DialogBodyText>
                    </div>
                </Field>
                {(settings.mode === 'custom' || settings.discoveryMode === 'custom') && (
                    <Field
                        label="Custom disclosure phrases"
                        description="Shared with Custom mode in every storefront sidebar. Separate phrases with semicolons; matching ignores capitalization."
                        childrenLayout="below"
                        childrenContainerWidth="max"
                    >
                        <div style={stack}>
                            <TextField
                                aria-label="Custom disclosure phrases"
                                value={phraseDraft}
                                onChange={(e) => setPhraseDraft(e.currentTarget.value)}
                            />
                            <DialogButton
                                onClick={() =>
                                    save(
                                        setPhrases(
                                            normalizeSettings({
                                                phrases: phraseDraft.split(/[;\n]+/),
                                            }).phrases ?? [],
                                        ),
                                    )
                                }
                            >
                                Apply phrases
                            </DialogButton>
                        </div>
                    </Field>
                )}
            </section>
            <SettingsSection title="AI disclosure features">
                <DialogBodyText style={{ fontSize: 13, lineHeight: 1.5 }}>
                    Choose which additions appear in Steam. Filtering stays active.
                </DialogBodyText>
                <DialogCheckbox
                    label="AI tags"
                    description="Show usage labels on game cards, hover details and game pages."
                    checked={settings.showAITags !== false}
                    controlled
                    onChange={(checked) => save(setShowAITags(checked))}
                />
                <DialogCheckbox
                    label="Game-page disclosure section"
                    description="Show the collapsible disclosure near the top of a game's store page."
                    checked={settings.showStoreDisclosure !== false}
                    controlled
                    onChange={(checked) => save(setShowStoreDisclosure(checked))}
                />
            </SettingsSection>
            <SettingsSection title="Discovery AI Filter">
                <Field
                    label="Default filter"
                    description="Applies to recommendations, shelves and game cards outside filterable lists."
                    childrenLayout="below"
                    childrenContainerWidth="max"
                >
                    <div style={stack}>
                        <Dropdown
                            rgOptions={presets.map((p) => ({ data: p.mode, label: p.label }))}
                            selectedOption={settings.discoveryMode ?? 'off'}
                            onChange={(o) => save(setDiscoveryMode(o.data))}
                        />
                        <DialogBodyText
                            style={{ fontSize: 13, lineHeight: 1.5, margin: '8px 0 0' }}
                        >
                            {presetDescription(settings.discoveryMode ?? 'off')}
                        </DialogBodyText>
                    </div>
                </Field>
                <DialogBodyText style={{ fontSize: 14, margin: '12px 0 8px' }}>
                    Keep these games visible
                </DialogBodyText>
                <DialogCheckbox
                    label="Wishlisted games"
                    description="Exempt from discovery filtering. AI labels still appear."
                    checked={settings.preserveWishlist !== false}
                    controlled
                    onChange={(checked) => save(setPreserveWishlist(checked))}
                />
                <DialogCheckbox
                    label="Owned games"
                    description="Keep games Steam marks as in your library visible. AI labels still appear."
                    checked={settings.preserveOwned === true}
                    controlled
                    onChange={(checked) => save(setPreserveOwned(checked))}
                />
            </SettingsSection>
            <SettingsSection title="Exemptions">
                <DialogBodyText style={{ fontSize: 14, lineHeight: 1.5 }}>
                    Exempted titles remain visible with any filter.
                </DialogBodyText>
                <Field
                    label="Add by Steam App ID"
                    childrenLayout="below"
                    childrenContainerWidth="max"
                >
                    <div style={stack}>
                        <TextField
                            aria-label="Steam App ID"
                            value={appId}
                            onChange={(e) => setAppId(e.currentTarget.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') void add();
                            }}
                        />
                        <DialogButton onClick={() => void add()}>Add exemption</DialogButton>
                    </div>
                </Field>
                {!(settings.allowedApps ?? []).length && (
                    <DialogBodyText>No exemptions yet.</DialogBodyText>
                )}
                {(settings.allowedApps ?? []).map((id) => (
                    <Field
                        key={id}
                        label={knownApps.get(id)?.title ?? `App ${id}`}
                        childrenLayout="below"
                        childrenContainerWidth="max"
                    >
                        <div style={stack}>
                            <details>
                                <summary
                                    style={{ fontSize: 13, cursor: 'pointer', userSelect: 'none' }}
                                >
                                    AI disclosure
                                </summary>
                                <DialogBodyText
                                    style={{
                                        fontSize: 13,
                                        lineHeight: 1.5,
                                        whiteSpace: 'pre-wrap',
                                        margin: 0,
                                    }}
                                >
                                    {knownApps.get(id)?.notes ||
                                        'No saved Steam disclosure yet. Browse a listing containing this game to resolve its disclosure.'}
                                </DialogBodyText>
                            </details>
                            <DialogButton
                                onClick={() =>
                                    save(
                                        setAllowed(
                                            (settings.allowedApps ?? []).filter((n) => n !== id),
                                        ),
                                    )
                                }
                            >
                                Remove exemption
                            </DialogButton>
                        </div>
                    </Field>
                ))}
            </SettingsSection>
            <SettingsSection title="Custom filters">
                <DialogBodyText style={{ fontSize: 14, lineHeight: 1.5 }}>
                    Drag filters to change their order in the slider. Create a custom filter to
                    choose which disclosed uses or phrases to block.
                </DialogBodyText>
                <div role="list" data-aif-order-list="" aria-label="Filter order">
                    {presets.map((preset, index) => {
                        const filter = filters.find((f) => preset.mode === `custom:${f.id}`);
                        const locked = preset.mode === 'off';
                        return (
                            <div
                                key={preset.mode}
                                role="listitem"
                                data-aif-order={preset.mode}
                                style={{
                                    padding: 12,
                                    marginBottom: 8,
                                    background: 'rgba(255,255,255,.04)',
                                    border:
                                        dropTarget === preset.mode
                                            ? '1px solid #67c1f5'
                                            : '1px solid transparent',
                                    borderRadius: 3,
                                    opacity: dragging === preset.mode ? 0.55 : 1,
                                }}
                            >
                                <Focusable
                                    onPointerDown={(e) =>
                                        drag.current!.down(
                                            e.nativeEvent,
                                            e.currentTarget,
                                            preset.mode,
                                        )
                                    }
                                    onPointerMove={(e) => drag.current!.move(e.nativeEvent)}
                                    onPointerUp={(e) => drag.current!.up(e.nativeEvent)}
                                    onPointerCancel={() => drag.current!.cancel()}
                                    onLostPointerCapture={() => drag.current!.cancel()}
                                    tabIndex={locked ? undefined : 0}
                                    role={locked ? undefined : 'button'}
                                    aria-label={
                                        locked
                                            ? 'Show All, locked first'
                                            : `Reorder ${preset.label}. Drag or hold Alt and press Up or Down.`
                                    }
                                    onKeyDown={(e) => {
                                        if (
                                            !locked &&
                                            e.altKey &&
                                            (e.key === 'ArrowUp' || e.key === 'ArrowDown')
                                        ) {
                                            e.preventDefault();
                                            const target =
                                                presets[index + (e.key === 'ArrowUp' ? -1 : 1)];
                                            if (target) reorder(preset.mode, target.mode);
                                        }
                                    }}
                                    style={{
                                        cursor: locked ? 'default' : 'grab',
                                        fontSize: 14,
                                        padding: '4px 0',
                                        userSelect: 'none',
                                        touchAction: 'none',
                                    }}
                                >
                                    {locked ? '🔒' : '⠿'} {preset.label}
                                    {locked ? ' · always first' : ''}
                                </Focusable>
                                {filter && (
                                    <div style={stack}>
                                        <DialogBodyText style={{ fontSize: 12 }}>
                                            Blocks:{' '}
                                            {filter.categories
                                                .map(
                                                    (k) =>
                                                        AI_CATEGORIES.find((c) => c.key === k)
                                                            ?.label,
                                                )
                                                .join(', ') || 'phrases only'}
                                            {filter.phrases.length
                                                ? ` · ${filter.phrases.length} phrases`
                                                : ''}
                                        </DialogBodyText>
                                        <DialogButton onClick={() => setEditing(filter)}>
                                            Edit filter
                                        </DialogButton>
                                        <DialogButton
                                            onClick={() => {
                                                if (editing?.id === filter.id) setEditing(null);
                                                save(
                                                    saveFilters(
                                                        filters.filter((f) => f.id !== filter.id),
                                                    ),
                                                );
                                            }}
                                        >
                                            Delete filter
                                        </DialogButton>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
                {!editing && (
                    <DialogButton
                        disabled={filters.length >= 30}
                        onClick={() =>
                            setEditing({
                                id: `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
                                name: '',
                                phrases: [],
                                categories: [],
                                match: 'any',
                            })
                        }
                    >
                        Create custom filter
                    </DialogButton>
                )}
                {editing && (
                    <FilterEditor
                        key={editing.id}
                        value={editing}
                        onCancel={() => setEditing(null)}
                        onSave={async (filter) => {
                            const existing = filters.some((f) => f.id === filter.id);
                            await saveFilters(
                                existing
                                    ? filters.map((f) => (f.id === filter.id ? filter : f))
                                    : [...filters, filter],
                            );
                            setEditing(null);
                        }}
                    />
                )}
            </SettingsSection>
            {error && <Field label={error} />}
        </>
    );
}
