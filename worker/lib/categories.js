const { classify, discover, assess, publisherKeys, evidenceOf } = require('../../public/category-policy');
const publicationCategories = (input, proposed) => classify(input, proposed);
module.exports = { publicationCategories, discoverCategories:discover, assess, publisherKeys, evidenceOf };
