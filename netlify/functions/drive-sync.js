'use strict';
/** Scheduled nightly (netlify.toml): pull GA drawings from Drive, push quotations and exports. */
const store = require('../../lib/store');
const drive = require('../../lib/drive');
const { exportsCsv } = require('../../lib/app');

exports.handler = async (event) => {
  store.connect(event);
  const report = await drive.sync({ exports: await exportsCsv(), budgetMs: 22000 });
  console.log('drive-sync', JSON.stringify(report));
  return { statusCode: 200, body: JSON.stringify(report) };
};
