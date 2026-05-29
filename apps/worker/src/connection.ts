export function getRedisOpts(url: string) {
  return { connection: { url, maxRetriesPerRequest: null } };
}
