# i18n helpers

Scripts for managing i18n translation keys and YAML files.

## Features
1. **Extract Missing Translations**: Scans `src/` for `lang('key')` patterns and identifies missing translations in `src/i18n/`.
2. **Update Locales**: Merges new translations from `dev/locales/input.yaml` into YAML files in `src/i18n/`.

## Usage

### Extract Missing Translations
1. Run `npm run i18n:findMissing`

2. Missing keys are written to `output.yaml`.

### Update Locales
1. Add translations to `dev/locales/input.yaml`:
    ```yaml
    en:
        $key: "English text"
    de:
        $key: "German text"
    ```

2. Run `npm run i18n:update`
