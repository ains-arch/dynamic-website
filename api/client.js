const { MongoClient, ServerApiVersion } = require('mongodb');
const { getLimit } = require('../data/filter/paginate');
const { formatArticleDate, getTags } = require('../data/filter/preprocess');

const uri = `mongodb+srv://reading-list:${process.env.PASSWORD}@cluster0.ptjwk.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const makeQuery = (req) => {
  const query = {};
  if (!req || !req.query) {
    return query;
  }
  if (req.query.tags) {
    const tags = req.query.tags.split('-');
    query.tags = { $in: tags };
  }
  if (req.query.search) {
    const escapedSearchQuery = req.query.search.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    );
    const fields = ['title', 'author', 'work', 'publisher', 'summary'];
    query.$or = fields.map((field) => ({
      [field]: { $regex: escapedSearchQuery, $options: 'i' },
    }));
  }
  return query;
};

const formatResults = (results, defaultArticle, tagText) =>
  results.map((result) => {
    return {
      ...defaultArticle,
      ...result,
      ...formatArticleDate(result),
      tags: getTags(result, tagText),
    };
  });

const getTagsMap = (allTagsArray) => {
  return allTagsArray.reduce((acc, tag) => {
    acc[tag.value] = tag.text;
    return acc;
  }, {});
};

const getPaginatedAndFilteredFromDb = async (
  collection,
  req,
  paginationDefaults
) => {
  const limit = getLimit(req.query.limit, paginationDefaults);
  const page = req.query.page ? parseInt(req.query.page, 10) : 1;
  const start = (page - 1) * limit;
  const dateKey = ['blockchain', 'shortform'].includes(collection)
    ? 'started'
    : 'date';
  const sortOrder = req.query.order && req.query.order === 'reverse' ? 1 : -1;
  const query = makeQuery(req);

  try {
    await client.connect();
    const db = client.db('reading-list');
    const documentsCollection = db.collection(collection);
    const tagsCollection = db.collection(`${collection}Tags`);

    const allTags = await tagsCollection.find().toArray();
    allTags.sort((a, b) =>
      a.text.toLowerCase().localeCompare(b.text.toLowerCase())
    );
    const tagText = getTagsMap(allTags);

    const cursor = documentsCollection.find(query);

    // Sort, paginate
    cursor.sort({ [dateKey]: sortOrder });
    if (start) {
      cursor.skip(start);
    }
    cursor.limit(limit);

    const results = await cursor.toArray();

    const totalFilteredResults = await documentsCollection.countDocuments(
      query
    );
    const totalUnfilteredResults = await documentsCollection.countDocuments();
    return {
      currentPage: page,
      pageSize: limit,
      results: formatResults(results, {}, tagText),
      totalPages: Math.ceil(totalFilteredResults / limit),
      totalResults: totalFilteredResults,
      totalUnfilteredResults,
      allTags,
    };
  } catch (err) {
    console.log(err);
  } finally {
    await client.close();
  }
};

const getLandingPageEntriesFromDb = async () => {
  try {
    await client.connect();
    const db = client.db('reading-list');
    const shortformCollection = db.collection('shortform');
    const blockchainCollection = db.collection('blockchain');

    const mostRecentShortform = await shortformCollection.findOne(
      {},
      { sort: { started: -1 } }
    );
    const mostRecentBlockchain = await blockchainCollection.findOne(
      {},
      { sort: { started: -1 } }
    );
    return { mostRecentBlockchain, mostRecentShortform };
  } catch (err) {
    console.log(err);
  } finally {
    await client.close();
  }
};

const getRssEntriesFromDb = async (collection) => {
  const limit = 20;
  try {
    await client.connect();
    const db = client.db('reading-list');

    // Get entries
    const documentsCollection = db.collection(collection);
    const cursor = documentsCollection
      .find({})
      .sort({ entryAdded: -1 })
      .limit(limit);
    const results = await cursor.toArray();

    // Get tags
    const tagsCollection = db.collection(`${collection}Tags`);
    const allTags = await tagsCollection.find().toArray();
    const tagsMap = getTagsMap(allTags);

    // Hydrate tags
    for (const article of results) {
      if ('tags' in article && article.tags.length) {
        for (const ind in article.tags) {
          const tagDetails = tagsMap[article.tags[ind]];
          article.tags[ind] = {
            value: article.tags[ind],
            text: tagDetails ? tagDetails.text : article.tags[ind],
          };
        }
      }
    }

    return results;
  } catch (err) {
    console.log(err);
  } finally {
    await client.close();
  }
};

module.exports = {
  getPaginatedAndFilteredFromDb,
  getLandingPageEntriesFromDb,
  getRssEntriesFromDb,
};
