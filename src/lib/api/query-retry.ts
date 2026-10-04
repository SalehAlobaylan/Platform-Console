// Refreshing/retrying a rejected backend token cannot repair its issuer or
// audience contract. The API client has already checked the Console session.
export function retryQuery(failureCount: number, error: unknown): boolean {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'upstream_authentication_failed'
  )
    return false;
  return failureCount < 1;
}
