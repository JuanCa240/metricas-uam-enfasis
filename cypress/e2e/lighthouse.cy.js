// ejecuta las pruebas para las páginas y dispositivos seleccionados.

const pages = require("../fixtures/pages.json");
const devices = require("../fixtures/devices.json");

const selectedProfile = Cypress.env("DEVICE_PROFILE");
const pageFilter = Cypress.env("PAGE_FILTER");

const deviceEntries = Object.entries(devices).filter(([key]) => {
  return !selectedProfile || selectedProfile === key;
});

const selectedPages = (() => {
  if (!pageFilter || pageFilter === "all") {
    return pages;
  }

  let filters = pageFilter;

  // Si recibimos un arreglo en formato JSON, lo convertimos.
  if (typeof filters === "string") {
    try {
      filters = JSON.parse(filters);
    } catch {
      // Si no es JSON, se interpreta como un nombre o una URL.
    }
  }

  // Si recibimos varios filtros, buscamos todas las páginas coincidentes.
  if (Array.isArray(filters)) {
    return pages.filter((page) =>
      filters.includes(page.name) || filters.includes(page.url)
    );
  }

  // Si recibimos un solo nombre o URL, buscamos esa página.
  return pages.filter(
    (page) => page.name === filters || page.url === filters
  );
})();

describe("Métricas Lighthouse de páginas institucionales UAM", () => {
  deviceEntries.forEach(([deviceKey, device]) => {
    describe(`Perfil: ${device.name}`, () => {
      selectedPages.forEach((page) => {
        it(`mide ${page.name}`, () => {
          cy.viewport(device.viewportWidth, device.viewportHeight);

          // Cypress verifica que la URL sea accesible antes de medirla.
          cy.visit(page.url, { failOnStatusCode: false, timeout: 150000 });
          cy.location("href").should("include", "autonoma.edu.co");

          cy.task("runLighthouse", {
            url: page.url,
            deviceKey,
            device
          }, { timeout: 180000 }).then((metric) => {
            cy.log(`Estado: ${metric.status}`);
            if (metric.status === "ERROR") {
              cy.log(`Error Lighthouse: ${metric.error || "Error no especificado"}`);
            } else {
              cy.log(`Performance: ${metric.performance}/100`);
              cy.log(`FCP: ${metric.firstContentfulPaint} ms`);
              cy.log(`LCP: ${metric.largestContentfulPaint} ms`);
              cy.log(`Speed Index: ${metric.speedIndex} ms`);
            }
          });
        });
      });
    });
  });
});
