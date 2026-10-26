# Zolexora AppSuite

Client intake portal & DevTeam operations console for commissioning custom software applications, managing legal contracts, and tracking development milestones.

## Permanent Brand Identity & Palette

Zolexora AppSuite adheres strictly to a 7-color premium monochrome metallic & dark navy design system:

| Swatch | Color Name | Hex Code | Purpose |
| :--- | :--- | :--- | :--- |
| ![Dark Navy](https://via.placeholder.com/15/0B1F3A/000000?text=+) | **Dark Navy** | `#0B1F3A` | Primary brand color & depth |
| ![Black](https://via.placeholder.com/15/080C14/000000?text=+) | **Black** | `#080C14` | Deep backgrounds & root surfaces |
| ![Silver](https://via.placeholder.com/15/CBD5E1/000000?text=+) | **Silver** | `#CBD5E1` | Metallic details, borders & highlights |
| ![White](https://via.placeholder.com/15/FFFFFF/000000?text=+) | **White** | `#FFFFFF` | High-contrast text & clean surfaces |
| ![Pure Black](https://via.placeholder.com/15/000000/000000?text=+) | **Pure Black** | `#000000` | Deepest shadows & pure contrast |
| ![Near Black](https://via.placeholder.com/15/0A0A0A/000000?text=+) | **Near Black** | `#0A0A0A` | Card containers & modal surfaces |
| ![Charcoal Gray](https://via.placeholder.com/15/404040/000000?text=+) | **Charcoal Gray** | `#404040` | Structural borders, dividers & neutral controls |

### Permanent Branding Rules
- **No accent colors**: Absolutely no bright blue, cyan, orange, yellow, red, emerald, or other unapproved accent colors.
- **Strict palette**: Only the seven approved colors and their lighter or darker shades.
- **Aesthetic**: Maintain a premium, professional, monochrome metallic aesthetic.
- **Contrast**: Use silver and white highlights with dark navy and black depth.
- **Consistency**: Applied uniformly across logos, app icons, favicons, UI components, and all AppSuite products.

## Getting Started

```bash
pnpm dev:client:infisical    # starts Client Portal on http://localhost:3070
pnpm dev:team:infisical      # starts DevTeam Console on http://localhost:3071
```

## Structure

- `apps/client/` — Client Portal (port 3070)
- `apps/dev-team/` — Internal Engineering & Legal Console (port 3071)
- `apps/backend/` — Express / Node REST API service
- `assets/branding/` — Master normalized brand assets (`appsuite-logo-master.png`, `appsuite-favicon-master.png`)
