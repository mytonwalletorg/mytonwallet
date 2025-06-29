const yaml = require('js-yaml');

/**
 * Converts YAML content to JSON for internationalization
 * @param {string} content - YAML content
 * @param {boolean} shouldThrowException - Whether to throw exception on error
 * @returns {string|undefined} JSON string or undefined on error
 */
function convertI18nYamlToJson(content, shouldThrowException = true) {
  try {
    const i18n = yaml.load(content);

    const json = Object.entries(i18n).reduce((acc, [key, value]) => {
      if (typeof value === 'string') {
        acc[key] = value;
      }
      if (typeof value === 'object') {
        acc[key] = { ...value };
      }

      return acc;
    }, {});

    return JSON.stringify(json, undefined, 2);
  } catch (err) {
    console.error(`Error converting YAML to JSON: ${err.message}`);

    if (shouldThrowException) {
      throw err;
    }
  }

  return undefined;
}

module.exports = { convertI18nYamlToJson }; 