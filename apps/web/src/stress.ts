/**
 * A generated figure of exactly `n` objects for frame timing (SPEC §17: "drag frame ≤ 8 ms at
 * 300 objects"): free points on a lattice, then in turn segments, circles through two
 * points, midpoints and lines, each built from earlier objects, so a drag of the first point
 * re-evaluates a realistic share of the figure. Deterministic; every name is valid.
 */
export function stressText(n: number): string {
  const lines = ['@version 1', `@title "${String(n)} objects"`];
  const points: string[] = [];
  const free = Math.min(n, Math.max(3, Math.floor(n / 5)));
  for (let i = 0; i < free; i++) {
    const name = `P${String(i + 1)}`;
    const x = (i % 10) - 4.5;
    const y = Math.floor(i / 10) - 2.5 + ((i * 7) % 5) / 10;
    lines.push(`${name} = (${String(x)}, ${String(y)})`);
    points.push(name);
  }
  const pick = (k: number) => points[k % points.length] ?? 'P1';
  for (let k = 0; lines.length - 2 < n; k++) {
    const [a, b] = [pick(k), pick(k * 3 + 1)];
    if (a === b) continue;
    switch (k % 4) {
      case 0:
        lines.push(`s${String(k)} = segment(${a}, ${b})`);
        break;
      case 1:
        lines.push(`c${String(k)} = circle(${a}, ${b}) [color=gray]`);
        break;
      case 2: {
        const m = `M${String(k)}`;
        lines.push(`${m} = midpoint(${a}, ${b})`);
        points.push(m);
        break;
      }
      default:
        lines.push(`l${String(k)} = line(${a}, ${b}) [color=blue, dash=dashed]`);
    }
  }
  return `${lines.join('\n')}\n`;
}
