/** Epochs for in-flight layer fetches. A late response must not re-enable a layer the operator turned off. */

export type LayerLoadEpochs = Record<string, number>

export function beginLayerLoad(epochs: LayerLoadEpochs, id: string): number {
  const next = (epochs[id] ?? 0) + 1
  epochs[id] = next
  return next
}

export function cancelLayerLoad(epochs: LayerLoadEpochs, id: string): void {
  epochs[id] = (epochs[id] ?? 0) + 1
}

export function isCurrentLayerLoad(epochs: LayerLoadEpochs, id: string, epoch: number): boolean {
  return epochs[id] === epoch
}
