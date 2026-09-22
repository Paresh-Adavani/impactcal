'use strict';
/** Netlify Function: the whole API. /api/* and /d/* are redirected here by netlify.toml. */
const serverless = require('serverless-http');
const store = require('../../lib/store');
const { app } = require('../../lib/app');

const handler = serverless(app);

/** Netlify keeps the original URL on a rewrite, so the path may arrive as
 *  /api/select, /.netlify/functions/api/select or /d/<token>. Normalise to the Express routes. */
function normalise(p) {
  return (p || '/').replace(/^\/\.netlify\/functions\/api(?=\/|$)/, '').replace(/^\/api(?=\/|$)/, '') || '/';
}

exports.handler = async (event, context) => {
  store.connect(event);                       // Netlify Blobs for this invocation
  const path = normalise(event.path);
  const rawUrl = event.rawUrl ? event.rawUrl.replace(/^(https?:\/\/[^/]+)\/.*$/, '$1') + path + (event.rawQuery ? '?' + event.rawQuery : '') : undefined;
  return handler({ ...event, path, ...(rawUrl ? { rawUrl } : {}) }, context);
};
