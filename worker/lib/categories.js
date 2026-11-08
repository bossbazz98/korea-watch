const { classify, publisherKeys, evidenceOf } = require('../../public/category-policy');
const publicationCategories = (input, proposed) => classify(input, proposed);
module.exports = { publicationCategories, publisherKeys, evidenceOf };
