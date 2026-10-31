export interface SphereCounts {
  open: number;
  fillerMarked: number;
}

export const isSphereDone = (sphere: SphereCounts): boolean => sphere.open === sphere.fillerMarked;
