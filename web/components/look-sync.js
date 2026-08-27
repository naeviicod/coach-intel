'use client';

import { useEffect } from 'react';
import { applyAccent } from '../lib/accent';
import { applyBackground, DEFAULT_BACKGROUND } from '../lib/background';

export function LookSync({ accent, background }) {
  useEffect(() => {
    applyAccent(accent);
    let id = background || DEFAULT_BACKGROUND;
    try {
      id = window.localStorage.getItem('ci-background') || id;
    } catch {
      /* ignore */
    }
    if (id === 'pit') id = DEFAULT_BACKGROUND;
    applyBackground(id);
  }, [accent, background]);
  return null;
}
