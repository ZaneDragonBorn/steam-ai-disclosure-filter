import { Field, Dropdown, DialogButton, DialogBodyText, TextField } from 'millennium';
import { useState } from 'react';
import { CustomFilter } from '../shared/settings';
import { AI_CATEGORIES, AICategory } from '../shared/classification';
import { stack, categoryHelp } from './ui';
export function FilterEditor({
    value,
    onSave,
    onCancel,
}: {
    value: CustomFilter;
    onSave: (filter: CustomFilter) => Promise<void>;
    onCancel: () => void;
}) {
    const [name, setName] = useState(value.name);
    const [terms, setTerms] = useState(value.phrases.join('; '));
    const [categories, setCategories] = useState<AICategory[]>(value.categories);
    const [match, setMatch] = useState(value.match);
    const [error, setError] = useState('');
    const submit = async () => {
        const phrases = terms
            .split(/[;\n]+/)
            .map((p) => p.trim())
            .filter(Boolean);
        if (!name.trim()) {
            setError('Give this filter a name.');
            return;
        }
        if (!phrases.length && !categories.length) {
            setError('Choose a classification or enter a phrase.');
            return;
        }
        try {
            await onSave({ ...value, name: name.trim(), phrases, categories, match });
        } catch {
            setError('Could not save the filter. Please retry.');
        }
    };
    return (
        <div style={stack}>
            <TextField
                label="Filter name"
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
            />
            <TextField
                label="Disclosure phrases (separate with semicolons)"
                value={terms}
                onChange={(e) => setTerms(e.currentTarget.value)}
            />
            <DialogBodyText style={{ fontSize: 13 }}>
                Choose which AI usage types to block, or enter phrases to look for in a title's
                disclosure.
            </DialogBodyText>
            {AI_CATEGORIES.map((c) => (
                <Field
                    key={c.key}
                    label={c.label}
                    description={categoryHelp[c.key]}
                    childrenLayout="below"
                    childrenContainerWidth="max"
                >
                    <Dropdown
                        rgOptions={[
                            { data: false, label: 'Allow' },
                            { data: true, label: 'Block' },
                        ]}
                        selectedOption={categories.includes(c.key)}
                        onChange={(o) =>
                            setCategories(
                                o.data
                                    ? [...categories.filter((k) => k !== c.key), c.key]
                                    : categories.filter((k) => k !== c.key),
                            )
                        }
                    />
                </Field>
            ))}
            <Field
                label="When should this filter block a game?"
                childrenLayout="below"
                childrenContainerWidth="max"
            >
                <Dropdown
                    rgOptions={[
                        { data: 'any', label: 'Either rule can block' },
                        { data: 'all', label: 'Both rules must match' },
                    ]}
                    selectedOption={match}
                    onChange={(o) => setMatch(o.data)}
                />
            </Field>
            <DialogBodyText style={{ fontSize: 13 }}>
                {match === 'any'
                    ? 'Block a title if it uses any AI type set to Block, or its disclosure contains any of your phrases.'
                    : 'Block a title only if it uses an AI type set to Block and its disclosure contains one of your phrases. If you leave either list empty, only the other rule applies.'}
            </DialogBodyText>
            {error && <DialogBodyText role="alert">{error}</DialogBodyText>}
            <DialogButton onClick={() => void submit()}>Save filter</DialogButton>
            <DialogButton onClick={onCancel}>Cancel</DialogButton>
        </div>
    );
}
