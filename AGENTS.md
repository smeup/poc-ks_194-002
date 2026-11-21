# Antigravity Development Instructions

This project is a functional prototype boilerplate. When developing with Antigravity, follow these rules to maintain the stack:

## Stack Overview
- **Frontend**: React + Vite
- **Styling**: Tailwind CSS (Utility-first, no custom CSS files or complex styles). **Mandatory use of custom palettes defined in `tailwind.config.js`**.
- **Data**: No database. All data must be loaded from JSON files located in `src/json/`.
- **Deployment**: Configured for subdirectory deployment on `poc.smeup.com`.

## How to Develop
1. **Adding Data**: Create or modify `.json` files in `src/json/`.
2. **Components**: Build React components in `src/components/`. Use standard Tailwind classes for styling.
3. **Logic**: Use standard React hooks for state and effects.
4. **Data Fetching**: Use `fetch('./json/yourfile.json')` to retrieve data. Note the relative path `./` which is essential for subdirectory deployment.

## Constraints
- **NO CSS FILES**: Do not create generic `.css` files unless absolutely necessary for external libraries. Use Tailwind classes.
- **NO DATABASE**: Do not attempt to connect to a real database or create database tables. Every "table" or entity must instead be represented by a JSON file located in `src/json/`.
- **RELATIVE PATHS**: Always use relative paths for assets and data fetching to ensure the prototype works when deployed under a subpath (e.g., `/prototype_1/`). **These paths are relative to the `BASE_URL` (or `BASE_PATH`) set in the `.env` file.**
- **NO ARBITRARY COLORS**: Do not use standard Tailwind colors (e.g., `bg-blue-500`) or arbitrary hex values. Exclusively use classes from the `brand-*` palettes defined in `tailwind.config.js`.

## Design & Colors
The project uses a specific brand palette. Always use these tokens for UI elements:

### Brand Colors & Shades
Each color has a scale from 100 to 900. The base color is accessible without a suffix or with `-500`.

- **Primary**: `brand-primary` (Color: `#A61A2F`) - Shades: `brand-primary-100` ... `brand-primary-900`
- **Success**: `brand-success` (Color: `#22B53D`) - Shades: `brand-success-100` ... `brand-success-900`
- **Info**: `brand-info` (Color: `#007D7F`) - Shades: `brand-info-100` ... `brand-info-900`
- **Warning**: `brand-warning` (Color: `#E27C0F`) - Shades: `brand-warning-100` ... `brand-warning-900`
- **Danger**: `brand-danger` (Color: `#B71D2F`) - Shades: `brand-danger-100` ... `brand-danger-900`

### Brand Gradients
Use these predefined gradients for prominent components:
- `bg-brand-gradient-primary`
- `bg-brand-gradient-success`
- `bg-brand-gradient-info`
- `bg-brand-gradient-warning`
- `bg-brand-gradient-danger`

Example usage: 
- `<div className="bg-brand-gradient-primary p-10 rounded-3xl text-white">Featured Block</div>`
- `<div className="bg-brand-primary-100 text-brand-primary-900">Light alert</div>`
- `<button className="bg-brand-primary hover:bg-brand-primary-600 text-white px-4 py-2 rounded">Submit</button>`

## Project description
Before publishing, make sure a README.md file exists in the dist/ folder that describes the project clearly for the end user. If the file does not exist, create it. Keep the README.md in dist/ up to date: whenever the project changes in a meaningful way, update the description and information in the README before publishing.
