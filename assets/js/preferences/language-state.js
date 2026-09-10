export const RETURN_LANGUAGE_KEY = 'banyan:language-return';
export const RETURN_LANGUAGE_LABEL_KEY = 'banyan:language-return-label';

export function languageMessage(template, name) {
    return (template || '').replace(/\\n/g, '\n').replace(/\[?\{lang\}\]?/g, () => name);
}
