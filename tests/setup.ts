import { afterEach, vi } from "vitest";
import { resetStore } from "../src/core/store";

class ResizeObserverMock implements ResizeObserver {
  readonly observed = new Set<Element>();

  disconnect(): void {
    this.observed.clear();
  }

  observe(target: Element): void {
    this.observed.add(target);
  }

  unobserve(target: Element): void {
    this.observed.delete(target);
  }
}

Object.defineProperty(globalThis, "ResizeObserver", {
  writable: true,
  value: ResizeObserverMock,
});

// jsdom ships no Pointer Capture API, and the swipe handlers rely on it.
for (const method of ["setPointerCapture", "releasePointerCapture"] as const) {
  Object.defineProperty(HTMLElement.prototype, method, {
    writable: true,
    value: vi.fn(),
  });
}

Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
  writable: true,
  value: vi.fn(() => false),
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

afterEach(() => {
  resetStore();
  vi.useRealTimers();
});
