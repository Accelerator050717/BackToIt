import { createContext, useContext, type ReactNode } from 'react';
import type { Language } from '../domain/types';

const LanguageContext = createContext<Language>('zh-CN');
export function LanguageProvider({ language, children }: { language: Language; children: ReactNode }) {
  return <LanguageContext.Provider value={language}>{children}</LanguageContext.Provider>;
}
export function useText() {
  const language = useContext(LanguageContext);
  return {
    language,
    t: (zh: string, en: string) => (language === 'zh-CN' ? zh : en),
    number: (value: number) => new Intl.NumberFormat(language).format(value),
    date: (time: number) =>
      new Date(time).toLocaleString(language, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
  };
}
