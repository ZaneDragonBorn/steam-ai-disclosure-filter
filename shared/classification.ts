/** Local, explainable interpretation of Steam's free-text disclosure. These are
 * plugin rules, never Valve-provided categories or proof about undisclosed use. */
export const AI_CATEGORIES = [
    { key: 'light', label: 'AI - Light' },
    { key: 'audio', label: 'AI - Audio' },
    { key: 'visual', label: 'AI - Content' },
    { key: 'interactive', label: 'AI - Interactive' },
    { key: 'heavy', label: 'AI - Heavy' },
    { key: 'unclassified', label: 'AI - Unclear' },
] as const;
export type AICategory = (typeof AI_CATEGORIES)[number]['key'];
export interface Classification {
    key: AICategory;
    label: string;
    reason: string;
    categories: AICategory[];
}
const assistance =
    'during the development process, we may use procedural- and ai-based tools to assist with content creation. in all such cases, the final product reflects the creativity and expression of our own development team.';
function result(key: AICategory, reason: string, categories: AICategory[] = [key]): Classification {
    return { key, label: AI_CATEGORIES.find((c) => c.key === key)!.label, reason, categories };
}
export function classifyDisclosure(notes: string): Classification {
    const text = notes.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!text)
        return result('unclassified', 'A disclosure was found, but its text is unavailable.');
    // This contextual development-assistance statement, with an optional narrow
    // commentary TTS example, is explicitly permitted by the requested Light policy.
    if (
        text === assistance ||
        (text.startsWith(assistance + ' ') &&
            /^examples include voiceover audio where we utilize text-to-speech tools to e\.g\. generate the audio of our in-game commentators [\w &'’-]+\.?$/.test(
                text.slice(assistance.length + 1),
            ))
    ) {
        const audio = text !== assistance;
        return result(
            'light',
            audio
                ? 'Describes development assistance and a limited commentator voiceover example; allowed by the Light policy.'
                : 'Describes tools assisting a development team rather than asserting broadly generated game content.',
            audio ? ['light', 'audio'] : ['light'],
        );
    }
    // Keep contrast clauses separate. Exclude explicit negative/hypothetical
    // statements before considering domains, so "no AI art" is not visual use.
    const clauses = text
        .replace(/\be\.g\./g, 'for example')
        .replace(/\bnot only\b/g, '')
        .replace(/\bbut also\b/g, 'and')
        .split(/(?:[.!?;\n]+|\bbut\b|\bhowever\b|\bexcept\b)/)
        .map((s) => s.trim())
        .filter(Boolean);
    const positive = clauses.filter(
        (s) =>
            !/(?:\b(?:no|without) (?:ai|generative|runtime|live)|\bno (?:other|additional) use\b|\b(?:not|never) (?:use|used|generate|generated|include|included|ship|shipped)|\b(?:do|does|did|is|are|was|were) not\b|\b(?:might|could) use\b)/.test(
                s,
            ),
    );
    const referenceOnly = (s: string) =>
        /concept|reference|placeholder|sample/.test(s) &&
        /not (?:used|included|shipped)|removed|replaced (?:before|for) release|guide (?:human |voice )?actors/.test(
            s,
        );
    const lowConcept = clauses.some(referenceOnly);
    // A disclosure can introduce AI once, then list concrete features in separate
    // sentences/bullets. Carry that context only into an explicit generation use.
    const playerIllustrations = (s: string) =>
        /\bplayers?\b[^.]*\b(?:create|generat\w*)\b[^.]*\b(?:illustrat\w*|portraits?|images?)\b/.test(
            s,
        );
    const actionable = positive.filter(
        (s) =>
            /\b(?:ai|generat\w*|text-to-speech|tts|llm|suno|assistan\w*|translat\w*|locali[sz]\w*)\b/.test(
                s,
            ) ||
            (/\b(?:ai|llm)\b/.test(text) && playerIllustrations(s)),
    );
    const content = actionable.filter((s) => !referenceOnly(s));
    const joined = content.join('. ');
    const audio =
        /\b(?:voice(?:over|s| lines| acting)?|narrat\w*|audio|soundtrack|music|text-to-speech|tts)\b/.test(
            joined,
        );
    const visualMedia =
        /\b(?:art|artwork|illustrat\w*|textures?|images?|sprites?|portraits?|3d models?|visual assets?|in[- ]game assets?|in[- ]game content|game assets?)\b/.test(
            joined,
        );
    const written = content.some(
        (s) =>
            /\b(?:writing|stories|story|dialogue|narrative|in-game text)\b/.test(s) &&
            !/translat|locali[sz]/.test(s),
    );
    const visual = visualMedia || written;
    const interactive =
        /runtime[^.]*generat|generat[^.]*runtime|\b(?:live-generated|chatbots?|llm-powered)\b|(?:dynamically|real-time) generat|generat[^.]*real-time/.test(
            joined,
        ) || content.some(playerIllustrations);
    const categories: AICategory[] = [];
    if (audio) categories.push('audio');
    if (visual) categories.push('visual');
    if (interactive) categories.push('interactive');
    const broad =
        /\b(?:all|most|majority|extensively|extensive|primarily|almost all|throughout|entire)\b/.test(
            joined,
        );
    const wholeGame =
        /(?:entire|whole) (?:game|product)[^.]*generat|generat[^.]*(?:entire|whole) (?:game|product)/.test(
            joined,
        );
    if (
        (broad && [audio, visualMedia, written, interactive].filter(Boolean).length >= 2) ||
        wholeGame
    )
        return result(
            'heavy',
            'Explicitly describes broad generated content across multiple domains or the entire product.',
            ['heavy', ...categories],
        );
    if (categories.length)
        return result(
            interactive ? 'interactive' : visual ? 'visual' : 'audio',
            `Affirmatively describes ${categories.map((k) => ({ audio: 'generated audio/voices', visual: 'generated or AI-assisted game content/assets', interactive: 'player-driven or live generation' })[k as 'audio' | 'visual' | 'interactive']).join(' and ')}. The disclosure does not establish extensive generation across the game.`,
            categories,
        );
    const light =
        actionable.some((s) =>
            /translat|locali[sz]|cod(?:e|ing) (?:assistance|completion)|debugg|limited (?:development|backend) assistance|concept|reference/.test(
                s,
            ),
        ) || lowConcept;
    if (light)
        return result(
            'light',
            'Describes translation/localization, limited development assistance, or concept/reference material without an affirmative shipped-media or live-generation claim.',
        );
    return result(
        'unclassified',
        'The disclosure is too vague, mixed, or outside the supported language rules to assign a more specific category. Review the original text.',
    );
}
