import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
import ru from './locales/ru.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import es from './locales/es.json';
import pl from './locales/pl.json';
import zh from './locales/zh.json';
import ko from './locales/ko.json';
import ja from './locales/ja.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: en
      },
      ru: {
        translation: ru
      },
      fr: {
        translation: fr
      },
      de: {
        translation: de
      },
      es: {
        translation: es
      },
      pl: {
        translation: pl
      },
      zh: {
        translation: zh
      },
      ko: {
        translation: ko
      },
      ja: {
        translation: ja
      }
    },
    fallbackLng: 'en',
    debug: false,
    interpolation: {
      escapeValue: false
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage']
    }
  });

// Sync language changes with main process for action i18n
i18n.on('languageChanged', (lng) => {
  // Save to main process settings so actions can use the same language
  if (window.llmConfigAPI?.saveLanguage) {
    window.llmConfigAPI.saveLanguage(lng).catch(err => {
      console.error('Failed to sync language to main process:', err);
    });
  }
});

// Load language from main process on startup
if (window.llmConfigAPI?.getLanguage) {
  window.llmConfigAPI.getLanguage().then(lang => {
    if (lang && lang !== i18n.language) {
      i18n.changeLanguage(lang);
    }
  }).catch(err => {
    console.error('Failed to load language from main process:', err);
  });
}

export default i18n;