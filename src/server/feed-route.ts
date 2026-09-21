import type { FeedDefinition } from './feed-statistics';
import { recordFeedPull } from './feed-statistics';

export interface FeedResponseLifecycle {
  statusCode: number;
  once(event: 'finish', listener: () => void): void;
}

/** Registers a non-blocking counter update after a feed response completes. */
export function trackSuccessfulFeedResponse(response: FeedResponseLifecycle, definition: FeedDefinition, dataDir?: string): void {
  response.once('finish', () => {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      void recordFeedPull(definition, new Date(), dataDir).catch((error) => {
        console.error(`[Feed Statistics] ${error instanceof Error ? error.message : 'pull could not be recorded'}`);
      });
    }
  });
}
