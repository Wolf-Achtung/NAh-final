import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import de from './locales/de.json';
import en from './locales/en.json';
import fr from './locales/fr.json';
import it from './locales/it.json';
import es from './locales/es.json';

const resources = {
  de: { translation: de },
  en: { translation: en },
  fr: { translation: fr },
  it: { translation: it },
  es: { translation: es }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'de',
    fallbackLng: 'de',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;