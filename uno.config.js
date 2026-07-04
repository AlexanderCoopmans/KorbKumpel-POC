import { defineConfig } from 'unocss'
import transformerDirectives from '@unocss/transformer-directives'
import { presetDaisy } from 'unocss-preset-daisy'
import { presetWind3 } from '@unocss/preset-wind3'

export default defineConfig({
  presets: [
    presetWind3(),
    presetDaisy({
      styled: true,
      themes: [
        {
          korb_kumpel_theme: {
            primary: '#e0321f', // Primärfarbe
            'primary-content': '#ffffff', // Textfarbe auf Primärfarbe
            secondary: '#e9bd92', // Sekundärfarbe
            accent: '#e0aa67', // Akzentfarbe
            neutral: '#3d4451', // Neutrale Farbe
            'base-100': '#ffffff',
            'base-200': '#f9fafb',
            'base-300': '#d1d5db',
            info: '#2094f3', // Info
            success: '#009485', // Erfolg
            warning: '#ff9900', // Warnung
            error: '#ff5724', // Fehler
          },
        },
      ],
    }),
  ],
  transformers: [
    transformerDirectives(), // Ermöglicht @apply in CSS-Dateien
  ],
})
