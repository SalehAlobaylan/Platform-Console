'use client';

import { useEffect, useState } from 'react';
import type { SystemControlLocale } from '@/lib/systems/pods-pipeline';

export function useSystemControlLocale(requested?: SystemControlLocale) {
  const [locale, setLocale] = useState<SystemControlLocale>('en');
  useEffect(() => {
    const read = () =>
      setLocale(document.documentElement.lang.startsWith('ar') ? 'ar' : 'en');
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['lang'],
    });
    return () => observer.disconnect();
  }, []);
  return requested ?? locale;
}
