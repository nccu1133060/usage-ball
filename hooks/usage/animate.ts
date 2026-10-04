export function nextBarPercent(current: number, target: number, cells: number, elapsedMs: number): number {
  if (elapsedMs >= 1000) return target
  const half = 100 / (cells * 2)
  const currentHalves = Math.round(current / half)
  const targetHalves = Math.round(target / half)
  if (currentHalves === targetHalves) return target
  return (currentHalves + Math.sign(targetHalves - currentHalves)) * half
}

export function warningVisible(elapsedMs: number): boolean {
  return elapsedMs >= 3000 || Math.floor(Math.max(0, elapsedMs) / 250) % 2 === 0
}
