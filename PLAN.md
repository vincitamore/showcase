# Extended X.com Tweets Handling Plan

## Background

X.com (formerly Twitter) allows for tweets beyond the original 280 character limit. This document outlines the steps needed to properly fetch, store, and display these extended tweets in our application.

## Current Implementation Analysis

After examining the codebase, I've identified the following:

1. **API Request**: In our tweet fetching implementation, we use Twitter API v2 correctly, but we need to ensure we're explicitly requesting the full text of tweets.

2. **Tweet Storage**: Our storage mechanism appears to store the tweet text as provided by the API, but we need to verify that extended tweets are not being truncated.

3. **Tweet Display**: The blog-section component renders tweet text, but may need adjustments to properly handle extended tweets.

## Step-by-Step Implementation Plan

### 1. Improve API Request Parameters ✅

In `src/app/api/cron/fetch-tweets/route.ts`, update the search parameters to explicitly request the full text:

```typescript
// Update search parameters to ensure we get the full tweet text
const searchParams: any = {
  max_results: DAILY_TWEET_FETCH_LIMIT,
  'tweet.fields': 'created_at,public_metrics,entities,author_id,attachments,text',
  'user.fields': 'profile_image_url,username',
  'media.fields': 'url,preview_image_url,alt_text,type,width,height,duration_ms,variants',
  'expansions': 'author_id,attachments.media_keys,entities.mentions.username,referenced_tweets.id'
};
```

Also update the same parameters where we call `client.v2.search()` to ensure consistency.

Status: ✅ Completed

### 2. Verify Tweet Text Storage ✅

In our `processTweetsForCache` function, add logging to confirm we're capturing the full tweet text:

```typescript
// Add this logging in the tweet processing loop
logger.info('Tweet text info', {
  id: tweet.id,
  textLength: tweet.text.length,
  textSnippet: tweet.text.substring(0, 50) + (tweet.text.length > 50 ? '...' : ''),
  step: 'text-processing'
});
```

Status: ✅ Completed

### 3. Add Tweet Text Length Validation ✅

Add a validation helper to verify we're getting full tweets:

```typescript
// Add to route.ts
function validateTweetText(tweet: TweetV2): boolean {
  // Log warning if tweet appears to be truncated
  if (tweet.text.endsWith('…') && !tweet.text.endsWith('…https://')) {
    logger.warn('Tweet text appears to be truncated', {
      id: tweet.id,
      textLength: tweet.text.length,
      textEnd: tweet.text.substring(tweet.text.length - 20),
      step: 'tweet-text-validation'
    });
    return false;
  }
  return true;
}
```

Status: ✅ Completed

### 4. Update the Database Schema ✅

Our current Prisma schema now uses the Text type for the tweet text, ensuring that extended tweets up to 25,000 characters can be properly stored:

```prisma
model Tweet {
  id                    String        @id
  text                  String        @db.Text  // Changed to Text type
  // ... rest of the model
}
```

Status: ✅ Completed (schema updated but migration wasn't needed since PostgreSQL's String type already supports large text)

### 5. Improve Tweet Display Component ✅

Update `src/components/blog-section.tsx` to properly handle extended tweet text:

1. Add proper line breaking and text wrapping:
```typescript
// Update the CSS for tweet text display
<div className="whitespace-pre-wrap break-words text-sm">
  {renderTweetText(tweet.text, entities)}
</div>
```

2. Add a "Show more" / "Show less" toggle for very long tweets:
```typescript
// Add to the component
const [expandedTweets, setExpandedTweets] = useState<{[key: string]: boolean}>({});

const toggleTweetExpansion = (tweetId: string, e: React.MouseEvent) => {
  e.stopPropagation();
  setExpandedTweets(prev => ({
    ...prev,
    [tweetId]: !prev[tweetId]
  }));
};

// In the render function for tweet text
const isLongTweet = tweet.text.length > 280;
const isExpanded = expandedTweets[tweet.id] || false;
const displayText = isLongTweet && !isExpanded 
  ? tweet.text.substring(0, 280) + '...' 
  : tweet.text;

return (
  <>
    <div className="whitespace-pre-wrap break-words">
      {renderTweetText(displayText, entities)}
    </div>
    {isLongTweet && (
      <button 
        onClick={(e) => toggleTweetExpansion(tweet.id, e)}
        className="text-xs text-primary mt-1 hover:underline"
      >
        {isExpanded ? 'Show less' : 'Show more'}
      </button>
    )}
  </>
);
```

Status: ✅ Completed

### 6. Testing Extended Tweets

After implementing these changes, test with extended tweets:

1. Run the tweet fetch manually with a test query parameter:
```
GET /api/cron/fetch-tweets?test=true&dev_key=YOUR_DEV_SECRET
```

2. Check the logs to verify the full text is being captured.

3. Manually create a test tweet with > 280 characters to verify display.

Status: 🔄 Next steps - will test after deployment

### 7. Monitoring and Verification ✅

Add monitoring to ensure our extended tweet handling is working:

1. Add metrics logging for tweet text length:
```typescript
// In the fetch-tweets processing
let totalTextLength = 0;
let tweetCount = 0;
let longTweetCount = 0;

for (const tweet of extractedTweets) {
  totalTextLength += tweet.text.length;
  tweetCount++;
  if (tweet.text.length > 280) {
    longTweetCount++;
    logger.info('Processing long tweet', {
      id: tweet.id,
      length: tweet.text.length,
      step: 'long-tweet-processing'
    });
  }
}

logger.info('Tweet length statistics', {
  totalTweets: tweetCount,
  longTweets: longTweetCount,
  averageLength: tweetCount ? Math.round(totalTextLength / tweetCount) : 0,
  step: 'tweet-length-stats'
});
```

Status: ✅ Completed

## Implementation Timeline

1. ✅ Update API request parameters (30 minutes) - COMPLETED
2. ✅ Add text validation and logging (1 hour) - COMPLETED
3. ✅ Update database schema if needed (30 minutes) - COMPLETED
4. ✅ Improve tweet display component (2 hours) - COMPLETED
5. 🔄 Testing and verification (1 hour) - IN PROGRESS

## Notes on X.com Extended Tweet Format

As of the latest API documentation for X.com:

1. Tweets can be up to 25,000 characters for X Premium+ subscribers
2. Standard tweets remain at 280 characters
3. The Twitter API v2 should return the full text by default, but we're adding explicit parameters to ensure this

## References

- [Twitter API v2 Documentation](https://developer.twitter.com/en/docs/twitter-api/tweets/lookup/api-reference/get-tweets)
- [Twitter API v2 Tweet Object](https://developer.twitter.com/en/docs/twitter-api/data-dictionary/object-model/tweet) 