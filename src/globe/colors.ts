import type { GeoKind } from './types'

export function colorForKind(kind: GeoKind | string): string {
  if (kind === 'quake') return '#ff8a3d'
  if (kind === 'aircraft') return '#8b9cff'
  if (kind === 'alert') return '#ff5d6c'
  if (kind === 'vessel') return '#4cc9f0'
  if (kind === 'fire') return '#ff7a3d'
  if (kind === 'sat') return '#c4b5fd'
  if (kind === 'hazard') return '#e8b84a'
  return '#3ee0c8'
}
