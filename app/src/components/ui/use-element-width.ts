import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';

const MIN_WIDTH = 240;

export function useElementWidth(target: Readonly<Ref<HTMLElement | null>>, fallback: number): Ref<number> {
  const width = ref(fallback);
  let observer: ResizeObserver | undefined;
  const update = (value: number) => {
    if (value > 0) {
      width.value = Math.max(MIN_WIDTH, Math.round(value));
    }
  };
  onMounted(() => {
    const element = target.value;
    if (!element) {
      return;
    }
    update(element.clientWidth);
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    observer = new ResizeObserver(([entry]) => update(entry?.contentRect.width ?? 0));
    observer.observe(element);
  });
  onBeforeUnmount(() => observer?.disconnect());
  return width;
}
