import { describe, it, expect, afterEach } from 'vitest';
import { ScreenWakeLockController } from '../src/utils/wakeLock';

describe('ScreenWakeLockController', () => {
  const originalWakeLock = Object.getOwnPropertyDescriptor(navigator, 'wakeLock');

  afterEach(() => {
    if (originalWakeLock) {
      Object.defineProperty(navigator, 'wakeLock', originalWakeLock);
    } else {
      delete (navigator as unknown as { wakeLock?: unknown }).wakeLock;
    }
  });

  it('releases a lock that resolves after release() was requested', async () => {
    let resolveRequest: (s: EventTarget & { released: boolean; release(): Promise<void> }) => void =
      () => {};
    let releasedCount = 0;
    const sentinel = Object.assign(new EventTarget(), {
      released: false,
      type: 'screen' as const,
      onrelease: null,
      release: async (): Promise<void> => {
        releasedCount++;
        sentinel.released = true;
      },
    });
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: {
        request: () =>
          new Promise((resolve) => {
            resolveRequest = resolve;
          }),
      },
    });

    const controller = new ScreenWakeLockController();
    const acquiring = controller.acquire();
    await controller.release();
    resolveRequest(sentinel);
    await acquiring;

    expect(releasedCount).toBe(1);
    expect(controller.isHeld()).toBe(false);
  });
});
