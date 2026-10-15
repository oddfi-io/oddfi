'use client';
import { useEffect } from 'react';

export default function LocatorSetup() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      import('@locator/runtime').then((m) =>
        m.default({
          targets: {
            zed: {
              url: 'zed://file${projectPath}${filePath}:${line}:${column}',
              label: 'Zed',
            },
          },
          projectPath: '/Users/hang/work/oddfi-frontend/',
        })
      );
    }
  }, []);
  return null;
}
