import { DialogBodyText, DialogSubHeader, Field } from 'millennium';
import { AI_CATEGORIES } from '../shared/classification';
import { categoryHelp, section } from './ui';
export function Information() {
    return (
        <section aria-label="FAQ / Information" style={section}>
            <DialogSubHeader>About the filter</DialogSubHeader>
            <DialogBodyText style={{ fontSize: 14, lineHeight: 1.5 }}>
                Control which games you see using Steam's official generative AI disclosures. Your
                preset decides which disclosed uses to block; exemptions always stay visible.
            </DialogBodyText>
            <DialogSubHeader>AI classifications</DialogSubHeader>
            <DialogBodyText style={{ fontSize: 13, lineHeight: 1.5 }}>
                These are the plugin's interpretations of disclosure text, not Steam categories or
                quality ratings.
            </DialogBodyText>
            {AI_CATEGORIES.map((category) => (
                <Field
                    key={category.key}
                    label={category.label}
                    description={categoryHelp[category.key]}
                    bottomSeparator="standard"
                />
            ))}
            <DialogSubHeader>Limits</DialogSubHeader>
            <DialogBodyText style={{ fontSize: 14, lineHeight: 1.5 }}>
                Filtering is most reliable in searchable or filterable game lists. Some Discovery
                queues, pages and unique navigation layouts cannot always remove titles cleanly, so
                you may still encounter disclosed games there.
            </DialogBodyText>
            <DialogBodyText style={{ fontSize: 13, lineHeight: 1.5 }}>
                Unknown results stay visible. No disclosure found does not mean AI-free. Text
                classifications can be imperfect, and Steam updates may change supported layouts.
            </DialogBodyText>
        </section>
    );
}
