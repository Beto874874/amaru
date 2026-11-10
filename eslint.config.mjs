// Configuracion plana de ESLint (ESLint 10 + typescript-eslint).
// Ademas de estilo, impone las reglas de dependencia entre capas de la seccion 5.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

const MENSAJE_CAPAS =
  'Viola la arquitectura por capas (seccion 5 de la guia): cada capa solo puede usar la inmediatamente inferior.';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '.drizzle-pull/**', 'docs/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      eqeqeq: ['error', 'always'],
      'no-console': 'error',
    },
  },
  {
    // Nadie lee process.env excepto config/env.ts (y las herramientas de build).
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message: 'Usa `env` de src/config/env.ts; solo ese archivo lee process.env.',
        },
      ],
    },
  },
  {
    files: ['src/config/env.ts', 'drizzle.config.ts', 'vitest.config.ts', 'tests/**/*.ts'],
    rules: { 'no-restricted-properties': 'off' },
  },
  {
    // CONTROLLER: solo service, schemas y tipos. Nunca repository ni db.
    files: ['src/modules/*/controller.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['drizzle-orm', 'drizzle-orm/*'], message: MENSAJE_CAPAS },
            { group: ['**/config/db.js', '**/db/schema/**'], message: MENSAJE_CAPAS },
            { group: ['../*/repository.js', '**/modules/*/repository.js'], message: MENSAJE_CAPAS },
          ],
        },
      ],
    },
  },
  {
    // SERVICE: reglas de negocio. Nunca express ni drizzle.
    files: ['src/modules/*/service.ts', 'src/modules/*/*.service.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['express', 'express/*', '**/middlewares/**'], message: MENSAJE_CAPAS },
            { group: ['drizzle-orm', 'drizzle-orm/*'], message: MENSAJE_CAPAS },
            { group: ['**/config/db.js'], message: MENSAJE_CAPAS },
            { group: ['../*/repository.js', '**/modules/*/repository.js'], message: MENSAJE_CAPAS },
          ],
        },
      ],
    },
  },
  {
    // REPOSITORY: unico lugar que importa Drizzle. Nunca express ni service.
    files: ['src/modules/*/repository.ts', 'src/modules/*/*.repository.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['express', 'express/*', '**/middlewares/**'], message: MENSAJE_CAPAS },
            { group: ['../*/service.js', '**/modules/*/service.js'], message: MENSAJE_CAPAS },
            { group: ['**/*controller.js'], message: MENSAJE_CAPAS },
          ],
        },
      ],
    },
  },
);
