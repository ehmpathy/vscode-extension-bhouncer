/**
 * .what = formats bytes to human-readable string (B, KB, MB, GB)
 * .why = enables readable benefit display in output logs
 */
export const formatMemoryBytes = (input: { bytes: number }): string => {
  const { bytes } = input;

  // handle zero and negative
  if (bytes <= 0) return '0 B';

  // define units and thresholds
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const base = 1024;

  // find appropriate unit
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(base)),
    units.length - 1,
  );

  // calculate value in that unit
  const value = bytes / Math.pow(base, unitIndex);

  // format with appropriate precision
  const formatted =
    unitIndex === 0 ? value.toFixed(0) : value.toFixed(2);

  return `${formatted} ${units[unitIndex]}`;
};
