import { createI18n } from 'vue-i18n';
import de from './locale/de.json5';
import en from './locale/en.json5';

type MessageSchema = typeof en;
type AppLocale = 'de' | 'en';

const dateTimeFormat = {
  dateTime: { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' },
} as const;

export const i18n = createI18n<[MessageSchema], AppLocale, false>({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { de, en },
  datetimeFormats: { de: dateTimeFormat, en: dateTimeFormat },
});
