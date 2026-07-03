# System & Architecture Requirements: Shopping List Optimization App

This document serves as the ground-truth specification (`agents.md`) for AI Coding Agents to implement the Shopping List Application.

---

## 1. Tech Stack & Environment

- **Framework:** Vue 3 (Composition API)
- **Language:** JavaScript (JS)
- **Build Tool:** Vite
- **Routing:** Vue Router
- **State Management:** Pinia
- **Styling:** UnoCSS (with `@unocss/preset-wind` / Windy CSS rules)
- **UI Library:** DaisyUI (Refer to `.context/` directory for configuration rules and usage patterns)
- **Utilities:** VueUse
- **Animations:** `@formkit/auto-animate` (for smooth list additions, transitions, and optimization disclosures)
- **Code Standards:** All inline comments, code documentation, and explanations within the codebase **MUST** be written in **English**. The user interface (UI) text must be in **German**.

---

## 2. Layout & App Structure (Mobile-First)

The UI must behave like a native mobile app on smaller screens, resembling modern social media apps (e.g., Instagram bottom navigation). On desktop screens, a standard responsive layout is acceptable.

### Navigation: Bottom Tab Bar (3 Sections)

1. **Startseite (Home):**
   - Placeholder section reserved for future promotional offers.
   - Prominent Call-to-Action (CTA) link/button to route the user to the "Einkaufsliste" creation view.
2. **Einkaufsliste (Shopping List):**
   - The primary interactive workspace of the application.
3. **Profil (Profile):**
   - Generic placeholder section for user settings or profile details.

### Supermarkets

The supported supermarkets are:

- Aldi Süd: ID - aldi-sued
- REWE: ID - rewe
- LIDL: ID - lidl
- Netto: ID - netto-marken-discount

But if you can get that dynamically from the typesense db it would be even better

---

## 5. Instructions for AI Coding Agent

1. Read `.context/` to parse configuration guidelines especially for DaisyUI and UnoCSS before generating layout templates.
2. Don not write big components, views or composables cut them all into a moderate size
3. Document everything with JsDoc in english
