/**
 * .what = extracts file extension from uri string
 * .why = enables extension-based policy lookup for tab closure decisions
 */
export const getExtension = (input: { uri: string }): string => {
  // strip query params before extracting extension
  const path = input.uri.split('?')[0];

  // find last dot for extension extraction
  const lastDot = path.lastIndexOf('.');
  if (lastDot === -1) return '';

  // return lowercase extension including the dot
  return path.slice(lastDot).toLowerCase();
};
