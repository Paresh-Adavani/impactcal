'use strict';
/**
 * Local run (office PC / laptop): serves site/ and the API on http://localhost:5000
 * with the disk store in data/_store. No Netlify account needed to try everything.
 */
const express = require('express');
const path = require('path');
const PORT0 = process.env.PORT || 5000; if (!process.env.PUBLIC_URL) process.env.PUBLIC_URL = 'http://localhost:' + PORT0;
const { app: api } = require('../lib/app');

const app = express();
app.use('/api', api);
app.use('/d', (req, res, next) => { req.url = '/d' + req.url; api(req, res, next); });
app.use(express.static(path.join(__dirname, '..', 'site'), { etag: true, setHeaders: (res, p) => res.setHeader('Cache-Control', /\.(html|css|js)$/i.test(p) ? 'no-cache' : 'public, max-age=86400') }));
const PORT = process.env.PORT || 5000;
if (!process.env.PUBLIC_URL) process.env.PUBLIC_URL = 'http://localhost:' + PORT;
app.listen(PORT, () => console.log(`ImpactCal dev server  http://localhost:${PORT}   admin: http://localhost:${PORT}/admin.html`));
