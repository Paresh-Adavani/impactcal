'use strict';
/** Netlify Function: the whole API. /api/* and /d/* are redirected here by netlify.toml. */
const serverless = require('serverless-http');
const store = require('../../lib/store');
const { app } = require('../../lib/app');

const handler = serverless(app, {
  basePath: '/.netlify/functions/api',
  request: (req, event) => { req.netlifyEvent = event; },
});

exports.handler = async (event, context) => {
  store.connect(event);                       // Netlify Blobs for this invocation
  return handler(event, context);
};
