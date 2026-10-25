import { DialogControlsSectionHeader } from 'millennium';
import type { ReactNode } from 'react';
import type { AICategory } from '../shared/classification';
export const stack = {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    width: '100%',
    minWidth: 0,
} as const;
export const categoryHelp: Record<AICategory, string> = {
    light: 'Limited AI assistance, such as translation, localization, concept work, or narrowly scoped development assistance.',
    audio: 'Generated voices, narration, music or other audio.',
    visual: 'Generated artwork, illustrations, writing or in-game assets.',
    interactive:
        'Player-driven or live generation, such as character illustrations and AI conversations.',
    heavy: 'Explicit extensive generation across several parts of a game.',
    unclassified:
        'Steam discloses AI use but does not describe it clearly enough for a specific type.',
};
export const section = {
    border: '1px solid rgba(160,180,200,.25)',
    borderLeft: '3px solid #4c6b82',
    borderRadius: 4,
    padding: 12,
    marginTop: 16,
};

/** No accordion is exported by the installed Starlight component library.
 * Keep the browser's accessible disclosure behavior and Steam's section heading. */
export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
    return (
        <details open style={section}>
            <summary style={{ cursor: 'pointer', userSelect: 'none' }}>
                <DialogControlsSectionHeader style={{ display: 'inline' }}>
                    {title}
                </DialogControlsSectionHeader>
            </summary>
            {children}
        </details>
    );
}
