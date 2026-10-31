/**
 * Temporarily disabled participant-facing capabilities.
 *
 * The appointments implementation remains in the codebase and can be re-enabled
 * by flipping the flag. No appointment data or services are removed.
 */
export const participantFeatures = {
  appointments: false,
} as const;