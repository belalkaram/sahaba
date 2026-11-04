import localFont from 'next/font/local';

/**
 * Display face (OD-16): Liftaswash, licensed for web embedding, Arabic only.
 * The unicode-range keeps Latin letters on IBM Plex; the face includes
 * Arabic-Indic digits (U+0660–0669), which are part of the Arabic block.
 */
export const displayArabic = localFont({
  src: './fonts/sahaba-display-arabic.woff2',
  weight: '800',
  style: 'normal',
  display: 'swap',
  preload: false,
  variable: '--font-display-ar',
  fallback: ['IBM Plex Sans Arabic', 'system-ui', 'sans-serif'],
  declarations: [
    { prop: 'unicode-range', value: 'U+0600-06FF, U+0750-077F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF' },
  ],
});
