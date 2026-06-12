'use client';

import { useSyncExternalStore } from 'react';

const subscribeToHydration = (onStoreChange: () => void) => {
  const frame = window.requestAnimationFrame(onStoreChange);
  return () => window.cancelAnimationFrame(frame);
};

const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function useHydrated() {
  return useSyncExternalStore(subscribeToHydration, getClientSnapshot, getServerSnapshot);
}
