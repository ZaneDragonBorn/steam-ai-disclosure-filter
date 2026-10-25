import { definePlugin, IconsModule, Tabs } from 'millennium';
import { useState } from 'react';
import { SettingsContent } from './settings';
import { Information } from './information';

function PluginContent() {
    const [page, setPage] = useState('settings');
    // Steam owns tab navigation/styling. Keep the form mounted separately so a tab
    // change never discards an unsaved filter draft or a collapsed settings group.
    return (
        <>
            <Tabs
                activeTab={page}
                onShowTab={setPage}
                autoFocusContents={false}
                tabs={[
                    { id: 'settings', title: 'Settings', content: null },
                    { id: 'information', title: 'FAQ / Information', content: null },
                ]}
            />
            <div hidden={page !== 'settings'}>
                <SettingsContent />
            </div>
            <div hidden={page !== 'information'}>{page === 'information' && <Information />}</div>
        </>
    );
}
export default definePlugin(() => ({
    title: 'AI Disclosure Filter',
    icon: <IconsModule.Settings />,
    content: <PluginContent />,
}));
