const fs = require('fs');
const path = require('path');
const { convertI18nYamlToJson } = require('./convertI18nYamlToJson');

const ROOT_DIR = path.resolve(__dirname, '../..');
const SOURCE_FILE = path.resolve(ROOT_DIR, 'src/i18n/en.yaml');
const TARGET_FILE = path.resolve(ROOT_DIR, 'src/i18n/en.json');

function buildDefaultI18n() {
  try {
    console.log('Generating default internationalization file...');

    if (!fs.existsSync(SOURCE_FILE)) {
      console.error(`Source file not found: ${SOURCE_FILE}`);
      process.exit(1);
    }

    const yamlContent = fs.readFileSync(SOURCE_FILE, 'utf8');
    const jsonContent = convertI18nYamlToJson(yamlContent);

    if (!jsonContent) {
      console.error('Failed to convert YAML to JSON');
      process.exit(1);
    }

    fs.writeFileSync(TARGET_FILE, jsonContent, 'utf-8');
    console.log(`Successfully created file: ${TARGET_FILE}`);
  } catch (error) {
    console.error(`Error generating file: ${error.message}`);
    process.exit(1);
  }
}

buildDefaultI18n();
