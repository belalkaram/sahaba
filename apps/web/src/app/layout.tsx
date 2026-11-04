import type { Metadata, Viewport } from 'next';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-700.css';
import '@fontsource/ibm-plex-sans-arabic/latin-400.css';
import '@fontsource/ibm-plex-sans-arabic/latin-500.css';
import '@fontsource/ibm-plex-sans-arabic/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/latin-700.css';
import './globals.css';
import { displayArabic } from './fonts';
import { Providers } from '../components/providers';
import PwaRegister from '../components/PwaRegister';
import { BRAND } from '../config/brand';

export const metadata: Metadata = {
  title: {
    default: `${BRAND.nameAr} — ${BRAND.taglineAr}`,
    template: `%s · ${BRAND.nameAr}`,
  },
  description: BRAND.descriptionAr,
  applicationName: BRAND.nameAr,
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0C7F6D' },
    { media: '(prefers-color-scheme: dark)', color: '#1F2A27' },
  ],
  colorScheme: 'light dark',
};

/*
 * Runs before first paint: applies the stored theme (or the OS preference for
 * "system") so there is no light/dark flash. Mirrors ThemeProvider's logic.
 */
const themeBootScript = `
(function () {
  try {
    var stored = localStorage.getItem('lms_theme');
    var dark = stored === 'dark' || ((!stored || stored === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var root = document.documentElement;
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    root.classList.toggle('dark', dark);
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={displayArabic.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <Providers>
          <PwaRegister />
          {children}
        </Providers>
      </body>
    </html>
  );
}
