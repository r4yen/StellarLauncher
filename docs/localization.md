# German and English

Interface text is translated at render time with `useUiText` and `src/uiMessages.json`. The English message is the catalog key; German translations must keep the same named `{parameters}`. `translateUi` also recognizes interpolated status messages from background operations. Keep player names, folder names, project descriptions, paths and technical log output as user/source data rather than translating them.

Validation errors and known failures use translated messages. Unrecognized native or remote errors show a localized explanation with the original message available under Technical details. This preserves troubleshooting information without displaying untranslated errors as the main interface message.

Language changes update open screens, labels, dates, counters, tooltips, status text and the document language immediately. Native file dialogs receive the language at invocation. Settings are loaded near the start of startup; the accent color loads before the first UI render.

Run `npm run test:localization` to check template interpolation, known and unknown error handling, parameter parity and literal catalog usage. `npm run test:organization` checks movement and folder removal without deleting entries. Mocked desktop UI checks cover both languages, native dialog titles, setup and progress, persisted language, real drag/drop, folder selectors and the loading screen's initial color.
