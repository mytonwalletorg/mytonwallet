module.exports = {
  inputDir: './src/assets/font-icons',
  outputDir: './src/styles',
  name: 'brilliant-icons',
  fontTypes: ['woff', 'woff2'],
  assetTypes: ['css'],
  tag: '',
  // Use a custom Handlebars template
  templates: {
    css: './plugins/brilliant-icons.css.hbs',
  },
};
