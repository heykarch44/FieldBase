/**
 * Race a promise against a hard timeout so stuck network/Supabase calls
 * can't indefinitely block the provider tree on foreground.
 *
 * Returns the fallback value if the timeout elapses first.
 */
export function withTimeout<T>(
  promise: PromiseLike<T>,
  ms: number,
  fallback: T
): Promise<T> {
  return Promise.race([
    Promise.resolve(promise).catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}
