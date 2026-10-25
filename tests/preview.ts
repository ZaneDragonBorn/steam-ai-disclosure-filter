// Offline UI harness. Never imported by the Millennium entries.
import { SidebarUI } from '../webview/ui/sidebar';
import { normalizeSettings } from '../shared/settings';
const ui = new SidebarUI(
    document,
    async (patch) => {
        settings = normalizeSettings({ ...settings, ...patch });
        ui.update(settings);
    },
    (doc) => [...doc.querySelectorAll<HTMLElement>('#additional_search_options')],
);
let settings = normalizeSettings({ mode: 'custom' });
ui.update(settings);
ui.review(
    [
        {
            appId: 1808500,
            title: 'ARC Raiders',
            notes: 'During the development process, we may use procedural- and AI-based tools to assist with content creation. In all such cases, the final product reflects the creativity and expression of our own development team.',
            allowed: false,
        },
    ],
    0,
    3,
);
