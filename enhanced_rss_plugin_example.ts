// =============================================================================
// ENHANCED RSS PLUGIN AFTER STANDARDIZATION - SIMPLIFIED APPROACH
// =============================================================================

import {
  type Plugin,
  PluginLoggerTag,
  ConfigurationError,
  PluginExecutionError,
  createConfigSchema,
  createSourceInputSchema,
  createSourceOutputSchema,
  createInputSchema,
  createOutputSchema,
  PlatformStateSchema,
  ContentType,
} from '@usersdotfun/core-sdk';
import { Effect } from 'effect';
import { z } from 'zod';
import { RssItemSchema, type RssItem, createClient, FeedConfigSchema } from '@curatedotfun/rss-service/api';
import { XMLParser } from 'fast-xml-parser';

// =============================================================================
// RSS SOURCE PLUGIN (Enhanced but Simplified)
// =============================================================================

const RssSourceStateSchema = z.object({
  lastProcessedItemGuid: z.string().optional(),
  lastProcessedItemTimestamp: z.string().datetime().optional(),
  feedEtag: z.string().optional(),
  lastModified: z.string().optional(),
});

type RssSourceState = z.infer<typeof RssSourceStateSchema>;

const SourceConfigSchema = createConfigSchema(
  z.object({
    feedUrl: z.string().url(),
    maxItems: z.number().min(1).max(100).default(50),
    timeout: z.number().min(1000).max(30000).default(10000),
    pollInterval: z.number().min(60).max(86400).default(300),
  }),
  z.object({
    authToken: z.string().optional(),
  })
);

const SourceInputSchema = createSourceInputSchema(
  z.object({}),
  PlatformStateSchema.extend({
    rssState: RssSourceStateSchema.optional(),
  })
);

const SourceOutputSchema = createSourceOutputSchema(
  RssItemSchema,
  PlatformStateSchema.extend({
    rssState: RssSourceStateSchema,
  })
);

export default class RssSourcePlugin implements Plugin<
  typeof SourceInputSchema,
  typeof SourceOutputSchema,
  typeof SourceConfigSchema
> {
  readonly id = '@curatedotfun/rss-source' as const;
  readonly type = 'source' as const;
  readonly inputSchema = SourceInputSchema;
  readonly outputSchema = SourceOutputSchema;
  readonly configSchema = SourceConfigSchema;

  private config: z.infer<typeof SourceConfigSchema> | null = null;
  private parser: XMLParser;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      parseAttributeValue: false,
      trimValues: true,
    });
  }

  initialize(config: z.infer<typeof SourceConfigSchema>): Effect.Effect<void, ConfigurationError, PluginLoggerTag> {
    const self = this;
    return Effect.gen(function* () {
      const logger = yield* PluginLoggerTag;
      
      // Simple health check - service handles timeouts/retries/security
      yield* Effect.tryPromise({
        try: () => fetch(config.variables!.feedUrl, { method: 'HEAD' }),
        catch: (error) => new ConfigurationError(`Cannot reach RSS feed: ${error}`)
      });

      self.config = config;
      yield* logger.logInfo('RSS source plugin initialized', {
        feedUrl: config.variables!.feedUrl
      });
    });
  }

  execute(input: z.infer<typeof SourceInputSchema>): Effect.Effect<z.infer<typeof SourceOutputSchema>, PluginExecutionError, PluginLoggerTag> {
    const self = this;
    return Effect.gen(function* () {
      if (!self.config) {
        return yield* Effect.fail(new PluginExecutionError('Not initialized', false));
      }

      const logger = yield* PluginLoggerTag;
      const { feedUrl, maxItems, timeout } = self.config.variables!;
      const lastState = input.lastProcessedState?.data?.rssState;

      // Build headers for conditional requests
      const headers: Record<string, string> = {
        'User-Agent': 'RSS Source Plugin/2.0',
        'Accept': 'application/rss+xml, application/xml, text/xml',
      };

      if (lastState?.feedEtag) headers['If-None-Match'] = lastState.feedEtag;
      if (lastState?.lastModified) headers['If-Modified-Since'] = lastState.lastModified;
      if (self.config.secrets?.authToken) headers['Authorization'] = `Bearer ${self.config.secrets.authToken}`;

      // Fetch RSS feed - service handles security, timeouts, retries
      const response = yield* Effect.tryPromise({
        try: () => fetch(feedUrl, { 
          headers, 
          signal: AbortSignal.timeout(timeout) 
        }),
        catch: (error) => new PluginExecutionError(`Fetch failed: ${error}`, true)
      });

      // Handle 304 Not Modified
      if (response.status === 304) {
        yield* logger.logDebug('Feed not modified, no new items');
        return {
          success: true,
          data: {
            items: [],
            nextLastProcessedState: {
              rssState: lastState!,
              latestProcessedId: lastState?.lastProcessedItemGuid,
            }
          }
        };
      }

      if (!response.ok) {
        return yield* Effect.fail(new PluginExecutionError(
          `HTTP ${response.status}`, 
          response.status >= 500
        ));
      }

      // Parse RSS content
      const xmlText = yield* Effect.tryPromise({
        try: () => response.text(),
        catch: () => new PluginExecutionError('Failed to read response', false)
      });

      const { items: parsedItems } = yield* self.parseRssFeed(xmlText);

      // Filter new items based on state
      let newItems = parsedItems;
      if (lastState?.lastProcessedItemGuid) {
        const lastIndex = parsedItems.findIndex(
          (item: RssItem) => item.guid === lastState.lastProcessedItemGuid
        );
        if (lastIndex >= 0) {
          newItems = parsedItems.slice(0, lastIndex);
        }
      }

      // Limit items
      const limitedItems = newItems.slice(0, maxItems);

      // Transform to platform format
      const pluginItems = limitedItems.map((item: RssItem) => ({
        externalId: item.guid || item.link,
        content: item.content,
        contentType: ContentType.ARTICLE,
        createdAt: item.publishedAt || new Date().toISOString(),
        url: item.link,
        authors: item.author ? [{ displayName: item.author }] : undefined,
        raw: item,
      }));

      // Update state
      const nextState: RssSourceState = {
        lastProcessedItemGuid: limitedItems[0]?.guid,
        lastProcessedItemTimestamp: limitedItems[0]?.publishedAt,
        feedEtag: response.headers.get('etag') || undefined,
        lastModified: response.headers.get('last-modified') || undefined,
      };

      yield* logger.logInfo('Processed RSS feed', { 
        newItems: limitedItems.length,
        totalItems: parsedItems.length 
      });

      return {
        success: true,
        data: {
          items: pluginItems,
          nextLastProcessedState: {
            rssState: nextState,
            latestProcessedId: limitedItems[0]?.guid,
          }
        }
      };
    });
  }

  private parseRssFeed(xmlText: string): Effect.Effect<{ items: RssItem[] }, PluginExecutionError> {
    const self = this;
    return Effect.gen(function* () {
      let parsedXml: any;
      
      try {
        parsedXml = self.parser.parse(xmlText);
      } catch (error) {
        return yield* Effect.fail(new PluginExecutionError(`Invalid XML format: ${error}`, false));
      }

      const items: RssItem[] = [];
      
      // Handle RSS format
      const rssItems = parsedXml?.rss?.channel?.item || [];
      const rssItemsArray = Array.isArray(rssItems) ? rssItems : [rssItems];
      
      // Handle Atom format  
      const atomEntries = parsedXml?.feed?.entry || [];
      const atomEntriesArray = Array.isArray(atomEntries) ? atomEntries : [atomEntries];
      
      // Process RSS items - plugin-specific parsing logic
      for (const item of rssItemsArray) {
        if (!item) continue;
        
        const title = item.title || '';
        const link = item.link || '';
        const content = item['content:encoded'] || item.description || '';
        const guid = item.guid?.['#text'] || item.guid || link;
        const pubDate = item.pubDate;
        const author = item.author || item['dc:creator'];
        const categories = Array.isArray(item.category) 
          ? item.category.map((cat: any) => typeof cat === 'string' ? cat : cat['#text']).filter(Boolean)
          : item.category ? [typeof item.category === 'string' ? item.category : item.category['#text']].filter(Boolean) : [];

        if (title || content) {
          items.push({
            id: guid,
            title,
            content,
            link,
            guid,
            author,
            publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
            categories,
          });
        }
      }
      
      // Process Atom entries - plugin-specific parsing logic
      for (const entry of atomEntriesArray) {
        if (!entry) continue;
        
        const title = entry.title?.['#text'] || entry.title || '';
        const link = entry.link?.['@_href'] || entry.link || '';
        const content = entry.content?.['#text'] || entry.summary?.['#text'] || entry.content || entry.summary || '';
        const guid = entry.id || link;
        const pubDate = entry.published || entry.updated;
        const author = entry.author?.name || entry.author;
        const categories = Array.isArray(entry.category) 
          ? entry.category.map((cat: any) => cat['@_term'] || cat).filter(Boolean)
          : entry.category ? [entry.category['@_term'] || entry.category].filter(Boolean) : [];

        if (title || content) {
          items.push({
            id: guid,
            title,
            content,
            link,
            guid,
            author,
            publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
            categories,
          });
        }
      }

      // Sort by date (newest first)
      items.sort((a, b) => 
        new Date(b.publishedAt!).getTime() - new Date(a.publishedAt!).getTime()
      );

      return { items };
    });
  }

  shutdown(): Effect.Effect<void, never, PluginLoggerTag> {
    const self = this;
    return Effect.gen(function* () {
      const logger = yield* PluginLoggerTag;
      yield* logger.logInfo('Shutting down RSS source plugin');
      self.config = null;
    });
  }
}

// =============================================================================
// RSS DISTRIBUTOR PLUGIN (Enhanced but Simplified)
// =============================================================================

const RssDistributorConfigSchema = createConfigSchema(
  z.object({
    serviceUrl: z.string().url(),
    feedId: z.string(),
    feedConfig: FeedConfigSchema.omit({ id: true }),
    autoCreateFeed: z.boolean().default(true),
  }),
  z.object({
    apiSecret: z.string().min(1),
  })
);

const RssDistributorInputSchema = createInputSchema(RssItemSchema);

const RssDistributorOutputSchema = createOutputSchema(
  z.object({
    itemId: z.string(),
    feedId: z.string(),
    message: z.string(),
    feedUrls: z.object({
      json: z.string(),
      rss: z.string(),
      atom: z.string(),
    }).optional(),
  })
);

export class RssDistributorPlugin implements Plugin<
  typeof RssDistributorInputSchema,
  typeof RssDistributorOutputSchema,
  typeof RssDistributorConfigSchema
> {
  readonly id = '@curatedotfun/rss' as const;
  readonly type = 'distributor' as const;
  readonly inputSchema = RssDistributorInputSchema;
  readonly outputSchema = RssDistributorOutputSchema;
  readonly configSchema = RssDistributorConfigSchema;

  private client: ReturnType<typeof createClient> | null = null;
  private config: z.infer<typeof RssDistributorConfigSchema> | null = null;

  initialize(config: z.infer<typeof RssDistributorConfigSchema>): Effect.Effect<void, ConfigurationError, PluginLoggerTag> {
    const self = this;
    return Effect.gen(function* () {
      const logger = yield* PluginLoggerTag;
      
      // Create typed HTTP client
      self.client = createClient(config.variables!.serviceUrl, config.secrets!.apiSecret);
      self.config = config;

      // Health check - service handles timeouts/retries
      const healthResponse = yield* Effect.tryPromise({
        try: () => self.client!.health.$get(),
        catch: (error) => new ConfigurationError(`Service unavailable: ${error}`)
      });

      if (!healthResponse.ok) {
        return yield* Effect.fail(new ConfigurationError(`Service health check failed: ${healthResponse.status}`));
      }

      // Auto-create feed if enabled - pure business logic
      if (config.variables!.autoCreateFeed) {
        const feedConfig = {
          ...config.variables!.feedConfig,
          id: config.variables!.feedId,
        };

        const response = yield* Effect.tryPromise({
          try: () => self.client!.api.feeds.$post({ json: feedConfig }),
          catch: (error) => new ConfigurationError(`Feed creation failed: ${error}`)
        });

        if (response.ok) {
          yield* logger.logInfo('Feed created/updated', { feedId: config.variables!.feedId });
        }
      }

      yield* logger.logInfo('RSS distributor plugin initialized', {
        serviceUrl: config.variables!.serviceUrl,
        feedId: config.variables!.feedId,
      });
    });
  }

  execute(input: z.infer<typeof RssDistributorInputSchema>): Effect.Effect<z.infer<typeof RssDistributorOutputSchema>, PluginExecutionError, PluginLoggerTag> {
    const self = this;
    return Effect.gen(function* () {
      if (!self.client || !self.config) {
        return yield* Effect.fail(new PluginExecutionError('Not initialized', false));
      }

      const logger = yield* PluginLoggerTag;
      const { feedId, serviceUrl } = self.config.variables!;

      // Add item to feed - pure business logic, service handles HTTP concerns
      const response = yield* Effect.tryPromise({
        try: () => fetch(`${serviceUrl}/api/feeds/${feedId}/items`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${self.config!.secrets!.apiSecret}`,
          },
          body: JSON.stringify(input),
        }),
        catch: (error) => new PluginExecutionError(`Request failed: ${error}`, true)
      });

      // Handle duplicate items gracefully
      if (response.status === 409) {
        const data = yield* Effect.tryPromise({
          try: () => response.json() as Promise<{ id: string; feedId: string }>,
          catch: () => new PluginExecutionError('Invalid response', false)
        });

        yield* logger.logInfo('Item already exists, skipping', { itemId: data.id });

        return {
          success: true,
          data: {
            itemId: data.id,
            feedId: data.feedId,
            message: 'Item already exists (skipped)',
            feedUrls: {
              json: `${serviceUrl}/${feedId}/feed.json`,
              rss: `${serviceUrl}/${feedId}/rss.xml`,
              atom: `${serviceUrl}/${feedId}/atom.xml`,
            },
          },
        };
      }

      if (!response.ok) {
        return yield* Effect.fail(new PluginExecutionError(
          `HTTP ${response.status}`,
          response.status >= 500
        ));
      }

      const data = yield* Effect.tryPromise({
        try: () => response.json() as Promise<{ id: string; feedId: string; message: string }>,
        catch: () => new PluginExecutionError('Invalid response', false)
      });

      yield* logger.logInfo('Item added successfully', {
        itemId: data.id,
        feedId: data.feedId
      });

      return {
        success: true,
        data: {
          itemId: data.id,
          feedId: data.feedId,
          message: data.message,
          feedUrls: {
            json: `${serviceUrl}/${feedId}/feed.json`,
            rss: `${serviceUrl}/${feedId}/rss.xml`,
            atom: `${serviceUrl}/${feedId}/atom.xml`,
          },
        },
      };
    });
  }

  shutdown(): Effect.Effect<void, never, PluginLoggerTag> {
    const self = this;
    return Effect.gen(function* () {
      const logger = yield* PluginLoggerTag;
      yield* logger.logInfo('Shutting down RSS distributor plugin');
      self.config = null;
    });
  }
}

// =============================================================================
// KEY CHANGES FROM ORIGINAL:
// =============================================================================
// 1. Removed console.* calls - using Effect logging throughout
// 2. Proper structured logging with context
// 3. Better error handling with appropriate retryable flags
// 4. Cleaner separation of concerns - plugin focuses on RSS-specific logic
// 5. Service layer handles: timeouts, retries, security validation, deep freezing
// 6. Plugin handles: RSS parsing, business logic, format-specific processing
// 7. Maintained Effect.js patterns throughout
// 8. Added ContentType enum usage for standardization
// =============================================================================
