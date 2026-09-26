const configuredValue = process.env.XMASDB_PUBLIC_API?.trim().toLowerCase();

/** Public API is available locally by default, but paused in production. */
export const PUBLIC_API_ENABLED = configuredValue === 'true'
  || (configuredValue !== 'false' && process.env.NODE_ENV !== 'production');
