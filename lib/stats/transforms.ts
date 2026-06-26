// Pre-OLS transform seam. This is the single point that makes the engine
// "MMM-ready": in v1 it is the identity function; v2 plugs adstock (carryover)
// and saturation (diminishing returns) here without touching OLS, the API
// contract, or the UI.

import type { ModelConfig } from './types';

export function applyTransforms(
  x: number[][],
  _config?: ModelConfig,
): number[][] {
  // TODO(v2): if config.transforms is present, apply per-column adstock
  // (geometric carryover with decay lambda) then saturation (Hill / log)
  // before returning. v1 passes raw values through unchanged.
  return x;
}
