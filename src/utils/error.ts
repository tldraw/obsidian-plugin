/**
 * Get a displayable message from a value that was thrown or used to reject a promise.
 */
export function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}
