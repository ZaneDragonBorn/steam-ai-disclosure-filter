import { DialogBodyText, DialogButton, Field } from 'millennium';
import { AI_CATEGORIES } from '../shared/classification';
import { categoryHelp, section } from './ui';

const BUG_REPORT_URL = 'https://github.com/ZaneDragonBorn/steam-ai-disclosure-filter/issues';
const text = { fontSize: 13, lineHeight: 1.5, margin: '8px 0' };
const heading = { ...text, fontSize: 14, fontWeight: 700, marginTop: 16 };
export function Information() {
    return (
        <section aria-label="FAQ / Information" style={section}>
            <DialogBodyText style={{ ...heading, marginTop: 0 }}>About</DialogBodyText>
            <DialogBodyText style={text}>
                Filter games using Steam's official generative AI disclosures.
            </DialogBodyText>
            <DialogBodyText style={heading}>Features &amp; help</DialogBodyText>
            <DialogBodyText style={text}>
                Use the generative AI filter option in Steam search or filtering menus, including
                category pages, wishlists, and Steam search. Set default filtering in plugin
                settings and create custom filters. Easily identify AI disclosures across Steam
                using AI classifications and disclosure text.
            </DialogBodyText>
            <DialogBodyText style={heading}>AI classifications</DialogBodyText>
            {AI_CATEGORIES.map((category) => (
                <Field
                    key={category.key}
                    label={
                        <DialogBodyText style={{ ...text, margin: 0, fontWeight: 700 }}>
                            {category.label}
                        </DialogBodyText>
                    }
                    description={
                        <DialogBodyText style={{ ...text, margin: 0 }}>
                            {categoryHelp[category.key]}
                        </DialogBodyText>
                    }
                    padding="compact"
                    bottomSeparator="standard"
                />
            ))}
            <DialogBodyText style={text}>
                Labels interpret disclosure text; they are not Steam ratings.
            </DialogBodyText>
            <DialogBodyText style={heading}>Limitations</DialogBodyText>
            <DialogBodyText style={text}>
                Searchable lists work best. Some discovery layouts cannot fully remove games.
                Unknown results stay visible; no disclosure does not mean AI-free. Text rules and
                Steam layout changes can affect accuracy.
            </DialogBodyText>
            <DialogBodyText style={heading}>Bug reports</DialogBodyText>
            <DialogBodyText style={text}>
                If you've encountered any bugs, please report them on GitHub.
            </DialogBodyText>
            <DialogButton
                disabled={!BUG_REPORT_URL}
                title={BUG_REPORT_URL ? 'Open GitHub' : 'GitHub link coming soon'}
                onClick={() => {
                    if (BUG_REPORT_URL)
                        window.open(BUG_REPORT_URL, '_blank', 'noopener,noreferrer');
                }}
            >
                Open GitHub
            </DialogButton>
        </section>
    );
}
