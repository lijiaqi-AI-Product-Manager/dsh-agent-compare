/** Git can lose a race finalizing an identical loose object on Windows.
 * Only retry this diagnostic around explicitly selected object writes. */
export declare function withGitObjectWriteRetry<T>(operation: () => Promise<T>, platform?: NodeJS.Platform): Promise<T>;
