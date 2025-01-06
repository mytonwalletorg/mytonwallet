const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { i18nDir } = require('./config');

const outputFilePath = path.resolve(__dirname, 'output.yaml');
const srcDir = './src';

function extractLangKeys(dir) {
  const langKeys = new Set();

  function traverse(directory) {
    const files = fs.readdirSync(directory);

    files.forEach((file) => {
      const fullPath = path.join(directory, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        traverse(fullPath);
      } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
        const content = fs.readFileSync(fullPath, 'utf8');

        const matches = content.matchAll(/lang\(\s*(['"`])((?:\\.|[^\\])*?)\1(?:,|\))/gs);

        for (const match of matches) {
          let key = match[2];

          key = key.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, '\n');

          langKeys.add(key);
        }
      }
    });
  }

  traverse(dir);
  return langKeys;
}

function findMissingTranslations(langKeys, i18nDir) {
  const missingTranslations = {};

  const localeFiles = fs.readdirSync(i18nDir).filter((file) => file.endsWith('.yaml'));

  localeFiles.forEach((file) => {
    const lang = path.basename(file, '.yaml');
    const filePath = path.join(i18nDir, file);
    const translations = yaml.load(fs.readFileSync(filePath, 'utf8')) || {};

    langKeys.forEach((key) => {
      if (!translations[key]) {
        if (!missingTranslations[lang]) {
          missingTranslations[lang] = {};
        }
        missingTranslations[lang][key] = key;
      }
    });
  });

  return missingTranslations;
}

function writeMissingTranslations(missingTranslations, outputFilePath) {
  const yamlContent = yaml.dump(missingTranslations, { noRefs: true, indent: 2 });
  fs.writeFileSync(outputFilePath, yamlContent, 'utf8');
  console.log(`Missing translations written to ${outputFilePath}`);
}

(function main() {
  console.log('Extracting lang keys from source code...');
  const langKeys = extractLangKeys(srcDir);

  console.log('Checking for missing translations...');
  const missingTranslations = findMissingTranslations(langKeys, i18nDir);

  console.log('Writing missing translations to output file...');
  writeMissingTranslations(missingTranslations, outputFilePath);
})();
