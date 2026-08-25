'use client';

import { useEffect } from 'react';

export default function OpenPage() {
  useEffect(() => {
    window.location.replace('coachintel://');
  }, []);

  return (
    <main className="open-fallback">
      <p>
        <a href="coachintel://">Open Coach Intel</a>
      </p>
    </main>
  );
}
