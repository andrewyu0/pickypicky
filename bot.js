var _           = require('lodash');
var Client      = require('node-rest-client').Client;
var Twit        = require('twit');
var async       = require('async');
var wordFilter  = require('wordfilter');

//@ay check out all these libraries, creative ways to use the methods

// Create instance of twit and pass
var t = new Twit({
  consumer_key:         : process.env.PICKYPICKY_TWIT_CONSUMER_KEY,
  consumer_secret:      : process.env.PICKYPICKY_TWIT_CONSUMER_SECRET,
  access_token          : process.env.PICKYPICKY_TWIT_ACCESS_TOKEN,
  access_token_secret   : process.env.PICKYPICKY_TWIT_ACCESS_TOKEN_SECRET
});

var wordnikKey = process.env.WORDNIK_API_KEY;


/**/
run = function(){
  /* waterfall takes an array of tasks, and optional cb. async ensures
  that each of the functions is called one at a time, passes results to the next
  function in the list. If any tasks fail, next function isn executed. instead
  main cb is called w an error
  
  getPublicTweet() attempts to grab a public tweet, if successful creates
  an object called botData
  */
  // @ay look into waterfall, and async library
  async.waterfall([
    getPublicTweet,
    extractWordsFromTweet,
    getAllWordDate,
    findNouns,
    formatTweet,
    postTweet
  ],
  // Error cb, error handling
  function(err, botData){
    if(err){
      console.log('There was a an error posting to Twitter: ', err);
    }
    else {
      console.log('Tweet successful!');
      console.log('Tweet: ', botData.tweetBlock);
    }
    console.log('Base tweet: ', botData.baseTweet)
  });
}
/*
@ay review node twit api, lots of methods to play with in the api docs
*/


getPublicTweet = function(cb) {
  // @ay need to look into twit api to get a good sense of what
  // the query is here - also, look for opportunities to vary 
  // this for future projects
  t.get('search/tweets', {q: 'a', count: 1, result_type: 'recent', lang: 'en'}, function(err, data, response) {
    if (!err) {
      var botData = {
        baseTweet       : data.statuses[0].text.toLowerCase(),
        tweetID         : data.statuses[0].id_str,
        tweetUsername   : data.statuses[0].user.screen_name
      };
      // botData object will grow as it is passed from one func to the next
      // building up elements needed to construct our bots tweet
      cb(null, botData);
    } else {
      console.log("There was an error getting a public Tweet. Abandoning EVERYTHING :(");
      cb(err, botData);
    }
  });
};

extractWordsFromTweet = function(botData, cb){
  var excludeNonAlpha       = /[^a-zA-Z]+/;
  var excludeURLs           = /https?:\/\/[-a-zA-Z0-9@:%_\+.~#?&\/=]+/g;
  var excludeShortAlpha     = /\b[a-z][a-z]?\b/g;
  var excludeHandles        = /@[a-z0-9_-]+/g;
  var excludePatterns       = [excludeURLs, excludeShortAlpha, excludeHandles];
  botData.tweet             = botData.baseTweet;

  _.each(excludePatterns, function(pat){
    // @ay look into .replace
    botData.tweet = botData.tweet.replace(pat, '');
  });

  botData.tweetWordList = botData.tweet.split(excludeNonAlpha);

  var excludedElements = ['and','the','pick','select','picking'];
  botData.tweetWordList = _.reject(botData.tweetWordList, function(w) {
    return _.contains(excludedElements, w);
  });

  cb(null, botData);
}

/*
getWordData() will be called for each word in the array
constructs url for Wordnik API endpoint to be called
*/
getWordData = function(word, cb) {
  
  var client = new Client();
  var wordnikWordURLPart1   = 'http://api.wordnik.com:80/v4/word.json/';
  var wordnikWordURLPart2   = '/definitions?limit=1&includeRelated=false&useCanonical=true&includeTags=false&api_key=';
  var args = {headers: {'Accept':'application/json'}};
  var wordnikURL = wordnikWordURLPart1 + word.toLowerCase() + wordnikWordURLPart2 + wordnikKey;

  client.get(wordnikURL, args, function (data, response) {
    if (response.statusCode === 200) {
      var result = JSON.parse(data);
      if (result.length) {
        cb(null, result);
      } else {
        cb(null, null);
      }
    } else {
      cb(null, null);
    }
  });
};

/*
Once words from tweet have been queried, we used findNouns()

*/
findNouns = function(botData, cb) {
  botData.nounList = [];
  botData.wordList = _.compact(botData.wordList);

  _.each(botData.wordList, function(wordInfo) {
    var word            = wordInfo[0].word;
    var partOfSpeech    = wordInfo[0].partOfSpeech;

    if (partOfSpeech == 'noun' || partOfSpeech == 'proper-noun') {
      botData.nounList.push(word);
    }
  });

  if (botData.nounList.length >= 3) {
    cb(null, botData);
  } else {
    cb('There are fewer than 3 nouns.', botData);
  }
}

/*
Tweet is constructed 
*/
postTweet = function(botData, cb) {
  if (!wordFilter.blacklisted(botData.tweetBlock)) {
    t.post('statuses/update', {status: botData.tweetBlock}, function(err, data, response) {
      cb(err, botData);
    });
  }
}