export interface SphereCounts {
  open: number;
}

export const isSphereDone = (sphere: SphereCounts): boolean => sphere.open === 0;
