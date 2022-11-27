const express = require('express');
const path = require('path');
const https = require('https');
const fs = require('fs');

let config;
if (process.argv[2] === 'prod') {
  config = require('./config');
}

const {
  getPaginatedAndFilteredFromDb,
  getRssEntriesFromDb,
} = require('./api/client');

const getPaginatedAndFiltered = require('./data/filter/getPaginatedAndFiltered');
const getLandingPageSummary = require('./data/filter/landing');
const getWikipediaWriting = require('./data/filter/wikipediaWritingFilter');
const getRssResults = require('./data/filter/rss');

const {
  READING_STATUSES_MAP,
  READING_STATUSES_LISTS,
} = require('./data/constants/readingStatuses');
const BOOK_DEFAULTS = require('./data/books/bookDefaults');

const backendRouter = require('./backend/routes/router');

const PORT = process.env.PORT || 5001;

const app = express();
app.use('/static', express.static(path.join(__dirname, 'js')));
app.set('views', path.join(__dirname, 'pug/views'));
app.set('view engine', 'pug');

app.get('/press', async (req, res) => {
  const results = await getPaginatedAndFilteredFromDb('press', req);
  const selectedTags = req.query.tags ? req.query.tags.split('-') : [];
  res.render('press.pug', {
    query: { ...req.query, tags: selectedTags },
    ...results,
  });
});

app.get('/reading', async (req, res) => {
  const results = await getLandingPageSummary();
  res.render('reading.pug', { READING_STATUSES_MAP, ...results });
});

app.get('/reading/shortform', async (req, res) => {
  const results = await getPaginatedAndFilteredFromDb('shortform', req);
  const selectedTags = req.query.tags ? req.query.tags.split('-') : [];
  res.render('shortform.pug', {
    query: { ...req.query, tags: selectedTags },
    ...results,
  });
});

app.get('/reading/blockchain', async (req, res) => {
  const results = await getPaginatedAndFilteredFromDb('blockchain', req);
  const selectedTags = req.query.tags ? req.query.tags.split('-') : [];
  res.render('blockchain.pug', {
    query: { ...req.query, tags: selectedTags },
    ...results,
  });
});

app.get('/reading/nonfiction', async (req, res) => {
  const results = await getPaginatedAndFiltered(
    '../books/nonFiction.json',
    BOOK_DEFAULTS,
    req,
    { default: 5 }
  );
  const selectedTags = req.query.tags ? req.query.tags.split('-') : [];
  const selectedStatuses = req.query.status ? req.query.status.split('-') : [];
  res.render('reference-books.pug', {
    query: { ...req.query, tags: selectedTags, statuses: selectedStatuses },
    READING_STATUSES_LIST: READING_STATUSES_LISTS.reference,
    READING_STATUSES_MAP,
    ...results,
  });
});

app.get('/reading/fiction', async (req, res) => {
  const results = await getPaginatedAndFiltered(
    '../books/fiction.json',
    BOOK_DEFAULTS,
    req,
    { default: 5 }
  );
  const selectedTags = req.query.tags ? req.query.tags.split('-') : [];
  const selectedStatuses = req.query.status ? req.query.status.split('-') : [];
  res.render('pleasure-books.pug', {
    query: { ...req.query, tags: selectedTags, statuses: selectedStatuses },
    READING_STATUSES_LIST: READING_STATUSES_LISTS.pleasure,
    READING_STATUSES_MAP,
    ...results,
  });
});

app.get('/wikipedia-work', async (req, res) => {
  const results = await getWikipediaWriting(req, { default: 20 });
  const selectedTopics = req.query.tags ? req.query.tags.split('-') : [];
  res.render('wikipedia-writing.pug', {
    query: { ...req.query, topics: selectedTopics },
    ...results,
  });
});

app.get(
  ['/reading/shortform/feed.xml', '/reading/dib/feed.xml'],
  async (req, res) => {
    const shortform = await getRssEntriesFromDb('shortform');
    const results = await getRssResults(shortform, 'rssArticle');
    res.set('Content-Type', 'text/xml');
    res.render('feed.pug', {
      prefix: 'shortform',
      results,
    });
  }
);

app.get('/reading/blockchain/feed.xml', async (req, res) => {
  const blockchain = await getRssEntriesFromDb('blockchain');
  const results = await getRssResults(blockchain, 'rssBlockchainArticle');
  res.set('Content-Type', 'text/xml');
  res.render('feed.pug', {
    prefix: 'blockchain',
    results,
  });
});

app.use('/dynamic-api', backendRouter);

if (process.argv[2] === 'prod') {
  https
    .createServer(
      {
        key: fs.readFileSync(`${config.certPath}/privkey.pem`),
        cert: fs.readFileSync(`${config.certPath}/cert.pem`),
        ca: fs.readFileSync(`${config.certPath}/chain.pem`),
      },
      app
    )
    .listen(PORT);
} else {
  app.listen(PORT);
}
