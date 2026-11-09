/**
 * Hash parameters keep the build portable (file://, any sub-path, GitHub Pages):
 *   #/?effect=bloom   add an effect     #/?preset=riso-print   apply a preset
 *   #/?p=<token>      shared stack      #/?photo=fire:2        pick the source photo
 */
export function initialParams(): URLSearchParams {
  const raw = window.location.hash.replace(/^#\/?/, "");
  const query = raw.includes("?") ? raw.split("?")[1] : raw;
  return new URLSearchParams(query);
}
