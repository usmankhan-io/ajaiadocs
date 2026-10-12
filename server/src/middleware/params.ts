/**
 * Safely extract a route param as a plain string.
 * Express types params as `string | string[]`; in practice route params are
 * always strings, but the type doesn't reflect that without ParamsDictionary.
 */
export function param(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}
