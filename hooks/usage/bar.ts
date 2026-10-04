export const LEVEL_HEX = { success: '#4EBA65', warning: '#E2B33C', error: '#FF6B80' } as const

export function barSvg(percent: number, width: number, level: keyof typeof LEVEL_HEX): string {
  const filled = Math.round(Math.max(0, Math.min(100, percent)) / 100 * width)
  const fill = filled > 0 ? `<rect x="0" y="0" width="${filled}" height="8" rx="4" fill="${LEVEL_HEX[level]}"/>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="8" viewBox="0 0 ${width} 8"><rect x="0" y="0" width="${width}" height="8" rx="4" fill="#8A8A8A" fill-opacity="0.3"/>${fill}</svg>`
}
