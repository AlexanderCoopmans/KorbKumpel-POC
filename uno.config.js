import { defineConfig, presetUno } from 'unocss'
import transformerDirectives from '@unocss/transformer-directives'
import { presetDaisy } from 'unocss-preset-daisy'

export default defineConfig({
  presets: [
    presetUno(), // Das Default-Styling (Tailwind-kompatibel)
    presetDaisy({
      // Hier kannst du DaisyUI-Themen konfigurieren (z.B. themes: ["light", "dark"])
    }),
  ],
  transformers: [
    transformerDirectives(), // Ermöglicht @apply in CSS-Dateien
  ],
})
