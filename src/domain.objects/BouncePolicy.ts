/**
 * .what = policy for when to close an editor tab
 * .why = enables per-extension control over idle vs tabs-limit closure
 *
 * IDLE_LIMIT = close only when idle timeout exceeded
 * TABS_LIMIT = close only when tabs limit exceeded and is LRU
 * BOTH = close on either condition (default behavior)
 */
export type BouncePolicy = 'IDLE_LIMIT' | 'TABS_LIMIT' | 'BOTH';
