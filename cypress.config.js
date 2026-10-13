import { defineConfig } from 'cypress';

// I test girano contro un'istanza isolata del gestionale officina (DB temporaneo, porte 4960/4961):
// vedi cypress/run.mjs. Non toccano mai i dati reali di officina/data.
export default defineConfig({
  e2e: {
    baseUrl: 'http://127.0.0.1:4960',
    specPattern: 'cypress/e2e/**/*.cy.js',
    supportFile: 'cypress/support/e2e.js',
    video: false,
    viewportWidth: 1280,
    viewportHeight: 900,
    defaultCommandTimeout: 8000,
  },
});
