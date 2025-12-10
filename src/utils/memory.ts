/**
 * Converts bytes to megabytes with 2 decimal places precision
 * @param bytes Number of bytes to convert
 * @returns Number in megabytes with 2 decimal places
 */
export const bytesToMB = (bytes: number): number => {
  return Number((bytes / (1024 * 1024)).toFixed(2));
};
