export class Translation {
    title: TranslationLang = new TranslationLang();
    name: TranslationLang = new TranslationLang();
    displayName: TranslationLang = new TranslationLang();
    alias: TranslationLang = new TranslationLang();
    description: TranslationLang = new TranslationLang();
    body: TranslationLang = new TranslationLang();

    constructor() {
        this.title = new TranslationLang();
        this.name = new TranslationLang();
        this.displayName = new TranslationLang();
        this.alias = new TranslationLang();
        this.description = new TranslationLang();
        this.body = new TranslationLang();
    }
    ParseJson(json: any): void {
        for (const key in json) {
            if (key == "title" || key == "name" || key == "displayName" || key == "alias" || key == "description" || key == "body") {
                const _translation = new TranslationLang();
                _translation.ParseJson(json[key])
                this[key] = _translation
            } else if (key in this) {
                this[key as keyof typeof this] = json[key];
            }
        }
    }
}

export class TranslationLang {
    en: string = "";
    ar: string = "";
    /** Additional site languages (fr, es, …) are carried dynamically so a
     *  language added in Multilingual is preserved through parse/save. */
    [lang: string]: string | ((json: any) => void);

    ParseJson(json: any): void {
        if (!json || typeof json !== "object") return;
        for (const key of Object.keys(json)) {
            if (typeof json[key] === "string") {
                (this as Record<string, string>)[key] = json[key];
            }
        }
    }
}