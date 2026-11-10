/** The image's dominant colours (median cut on a 64 px thumbnail), darkest first, as #rrggbb. */
export function imagePalette(src: TexImageSource | undefined | null, count = 18): string[] {
  if (!src) return [];
  const N = 64;
  const c = document.createElement("canvas");
  c.width = c.height = N;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  try { ctx.drawImage(src as CanvasImageSource, 0, 0, N, N); } catch { return []; }
  let data: Uint8ClampedArray;
  try { data = ctx.getImageData(0, 0, N, N).data; } catch { return []; }
  const px: number[][] = [];
  for (let i = 0; i < data.length; i += 4) px.push([data[i], data[i + 1], data[i + 2]]);
  let boxes = [px];
  while (boxes.length < count) {
    // Split the box with the widest channel range at its median.
    let bi = -1, bc = 0, br = -1;
    boxes.forEach((b, i) => {
      if (b.length < 2) return;
      for (let ch = 0; ch < 3; ch++) {
        let lo = 255, hi = 0;
        for (const p of b) { lo = Math.min(lo, p[ch]); hi = Math.max(hi, p[ch]); }
        if (hi - lo > br) { br = hi - lo; bi = i; bc = ch; }
      }
    });
    if (bi < 0) break;
    const b = boxes[bi].slice().sort((p, q) => p[bc] - q[bc]);
    const m = b.length >> 1;
    boxes = [...boxes.slice(0, bi), b.slice(0, m), b.slice(m), ...boxes.slice(bi + 1)];
  }
  const cols = boxes.map((b) => [0, 1, 2].map((ch) => Math.round(b.reduce((s, p) => s + p[ch], 0) / b.length)));
  while (cols.length < count) cols.push(cols[cols.length - 1] ?? [0, 0, 0]);
  cols.sort((a, b) => (a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722) - (b[0] * 0.2126 + b[1] * 0.7152 + b[2] * 0.0722));
  return cols.map((c3) => "#" + c3.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase());
}
