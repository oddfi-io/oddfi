import { QueryClient, isServer } from "@tanstack/react-query";

const QUERY_STALE_TIME = 10_000;
const QUERY_RETRY = 1;

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: QUERY_STALE_TIME,
        retry: QUERY_RETRY,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
  if (isServer) {
    // Server: always make a new QueryClient per request to prevent
    // cross-request data leaking between different users/pages.
    return makeQueryClient();
  }
  // Browser: reuse a singleton so route navigations keep the cache alive.
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}
