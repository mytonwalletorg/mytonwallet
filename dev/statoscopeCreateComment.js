/* eslint-env node */

const fs = require('fs');
const createPrComment = require('./statoscopeCreatePrComment');
const template = require('../.github/workflows/statoscope-comment');

module.exports = async ({ github, context, diffReportUrl }) => {
  const data = JSON.parse(fs.readFileSync('statoscope-result.json', 'utf8'));
  data.prNumber = context.issue.number;
  data.diffReportUrl = diffReportUrl;
  const body = template(data);

  await createPrComment({ github, context, body });
};
