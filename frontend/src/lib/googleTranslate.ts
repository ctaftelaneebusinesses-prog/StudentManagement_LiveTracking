/**
 * Whole-site translation powered by the Google Translate website widget.
 * We mount the widget once (invisible) at the app root and drive its
 * generated <select class="goog-te-combo"> element ourselves from a custom
 * language switcher, instead of showing Google's default toolbar.
 */

export interface TranslateLanguage {
  code: string;
  label: string;
  nativeLabel: string;
}

export const PAGE_LANGUAGE = "en";

export const TRANSLATE_LANGUAGES: TranslateLanguage[] = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
  { code: "te", label: "Telugu", nativeLabel: "తెలుగు" },
  { code: "kn", label: "Kannada", nativeLabel: "ಕನ್ನಡ" },
  { code: "ta", label: "Tamil", nativeLabel: "தமிழ்" },
];

const STORAGE_KEY = "sms_lang";
const WIDGET_ELEMENT_ID = "google_translate_element";

declare global {
  interface Window {
    google?: { translate?: { TranslateElement: new (options: Record<string, unknown>, elementId: string) => void } };
    googleTranslateElementInit?: () => void;
  }
}

export function getSavedLanguage(): string {
  return localStorage.getItem(STORAGE_KEY) || PAGE_LANGUAGE;
}

/** Loads the Google Translate script and mounts the (hidden) widget once. Safe to call multiple times. */
export function loadGoogleTranslate(): void {
  if (document.getElementById("google-translate-script")) return;

  window.googleTranslateElementInit = () => {
    new window.google!.translate!.TranslateElement(
      {
        pageLanguage: PAGE_LANGUAGE,
        includedLanguages: TRANSLATE_LANGUAGES.map((l) => l.code).join(","),
        autoDisplay: false,
      },
      WIDGET_ELEMENT_ID,
    );

    const saved = getSavedLanguage();
    if (saved !== PAGE_LANGUAGE) applyLanguage(saved);
  };

  const script = document.createElement("script");
  script.id = "google-translate-script";
  script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
  script.async = true;
  document.body.appendChild(script);
}

export function setLanguage(code: string): void {
  localStorage.setItem(STORAGE_KEY, code);
  applyLanguage(code);
}

/** The Google widget's <select> only exists once its async script has finished rendering, so retry briefly. */
function applyLanguage(code: string, attempt = 0): void {
  const select = document.querySelector<HTMLSelectElement>("select.goog-te-combo");
  if (!select) {
    if (attempt < 20) setTimeout(() => applyLanguage(code, attempt + 1), 250);
    return;
  }
  select.value = code;
  select.dispatchEvent(new Event("change"));
}
