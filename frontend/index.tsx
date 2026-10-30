import { definePlugin, IconsModule, DialogButton } from 'millennium';
import { useState } from 'react';
import { SettingsContent } from './settings';
import { Information } from './information';

function PluginContent() {
    const [page, setPage] = useState('settings');
    // Tabs remains a loading placeholder in this desktop Library Manager host.
    // Native DialogButtons work without that unavailable component resolver.
    const tabs = [
        { id: 'settings', label: 'Settings' },
        { id: 'information', label: 'Information' },
    ];
    return (
        <>
            <div
                role="tablist"
                aria-label="AI Disclosure Filter pages"
                style={{ display: 'flex', gap: 4, borderBottom: '1px solid #3d5060' }}
            >
                {tabs.map((tab) => (
                    <DialogButton
                        key={tab.id}
                        id={`aif-tab-${tab.id}`}
                        role="tab"
                        aria-selected={page === tab.id}
                        aria-controls={`aif-panel-${tab.id}`}
                        tabIndex={page === tab.id ? 0 : -1}
                        style={{
                            flex: 1,
                            borderRadius: '3px 3px 0 0',
                            borderBottom:
                                page === tab.id ? '3px solid #67c1f5' : '3px solid transparent',
                            background: page === tab.id ? '#324b60' : 'transparent',
                            color: page === tab.id ? '#fff' : '#a4b4c3',
                            fontWeight: page === tab.id ? 600 : 400,
                        }}
                        onClick={() => setPage(tab.id)}
                        onKeyDown={(event) => {
                            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
                                return;
                            event.preventDefault();
                            const next =
                                event.key === 'Home'
                                    ? 'settings'
                                    : event.key === 'End'
                                      ? 'information'
                                      : page === 'settings'
                                        ? 'information'
                                        : 'settings';
                            setPage(next);
                            event.currentTarget.parentElement
                                ?.querySelector<HTMLElement>(`#aif-tab-${next}`)
                                ?.focus();
                        }}
                    >
                        {tab.label}
                    </DialogButton>
                ))}
            </div>
            <div
                id="aif-panel-settings"
                role="tabpanel"
                aria-labelledby="aif-tab-settings"
                hidden={page !== 'settings'}
            >
                <SettingsContent />
            </div>
            <div
                id="aif-panel-information"
                role="tabpanel"
                aria-labelledby="aif-tab-information"
                hidden={page !== 'information'}
            >
                {page === 'information' && <Information />}
            </div>
        </>
    );
}
export default definePlugin(() => ({
    title: 'AI Disclosure Filter',
    icon: <IconsModule.Settings />,
    content: <PluginContent />,
}));
