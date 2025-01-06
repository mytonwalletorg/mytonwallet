const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { i18nDir } = require('./config');

const inputFilePath = path.resolve(__dirname, 'input.yaml');

function updateYamlFiles() {
  try {
    const inputContent = fs.readFileSync(inputFilePath, 'utf8');
    const inputData = yaml.load(inputContent);

    for (const lang in inputData) {
      const langData = inputData[lang];
      const yamlFilePath = path.join(i18nDir, `${lang}.yaml`);

      let existingData = {};

      if (fs.existsSync(yamlFilePath)) {
        const existingContent = fs.readFileSync(yamlFilePath, 'utf8');
        existingData = yaml.load(existingContent) || {};
      }

      const updatedData = {
        ...existingData,
        ...langData,
      };

      const updatedYaml = yaml.dump(updatedData, {
        noRefs: true,
        indent: 2,
        lineWidth: -1,
        quotingType: '"',
      });
      fs.writeFileSync(yamlFilePath, updatedYaml, 'utf8');

      console.log(`Updated: ${yamlFilePath}`);
    }

    console.log('All YAML files have been updated.');
  } catch (error) {
    console.error('Error updating YAML files:', error);
  }
}

updateYamlFiles();
