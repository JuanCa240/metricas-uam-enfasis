const { defineConfig } = require("cypress");
const fs = require("fs");
const path = require("path");
const chromeLauncher = require("chrome-launcher");
const dotenv = require("dotenv");

dotenv.config();

const fixturesPath = path.join(__dirname, "cypress", "fixtures");
const metricsPath = path.join(fixturesPath, "lighthouse-metrics.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function appendMetric(metric) {
  let metrics = [];
  if (fs.existsSync(metricsPath)) {
    try {
      metrics = readJson(metricsPath);
      if (!Array.isArray(metrics)) metrics = [];
    } catch {
      metrics = [];
    }
  }
  metrics.push(metric);
  fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2), "utf8");
  return metrics.length;
}

module.exports = defineConfig({
  video: false,
  screenshotOnRunFailure: true,
  e2e: {
    specPattern: "cypress/e2e/**/*.cy.js",
    supportFile: "cypress/support/e2e.js",
    defaultBrowser: "chrome",
    pageLoadTimeout: 90000,
    taskTimeout: 180000,
    requestTimeout: 30000,
    responseTimeout: 30000,
    setupNodeEvents(on, config) {
      on("task", {
        async runLighthouse({ url, deviceKey, device }) {
          let chrome;
          try {
            const { default: lighthouse } = await import("lighthouse");
            chrome = await chromeLauncher.launch({
              chromeFlags: ["--headless", "--no-sandbox", "--disable-dev-shm-usage"]
            });

            const result = await lighthouse(
              url,
              {
                port: chrome.port,
                output: "json",
                logLevel: "error"
              },
              {
                extends: "lighthouse:default",
                settings: {
                  onlyCategories: ["performance"],
                  formFactor: device.lighthouseConfig.formFactor,
                  screenEmulation: device.lighthouseConfig.screenEmulation
                }
              }
            );

            const audits = result.lhr.audits;
            const performanceScore = result.lhr.categories.performance.score;
            const metric = {
              url,
              type: deviceKey === "mobile" ? "Mobile" : "Desktop",
              device: device.name,
              screenEmulation: `${device.viewportWidth}x${device.viewportHeight}`,
              timestamp: new Date().toISOString(),
              firstContentfulPaint: Number(((audits["first-contentful-paint"].numericValue || 0) / 1000).toFixed(3)),
              largestContentfulPaint: Number(((audits["largest-contentful-paint"].numericValue || 0) / 1000).toFixed(3)),
              speedIndex: Number(((audits["speed-index"].numericValue || 0) / 1000).toFixed(3)),
              performance: Math.round((performanceScore || 0) * 100),
              status: "OK"
            };

            const totalRecords = appendMetric(metric);
            return { ...metric, totalRecords };
          } catch (error) {
            const metric = {
              url,
              type: deviceKey === "mobile" ? "Mobile" : "Desktop",
              device: device.name,
              screenEmulation: `${device.viewportWidth}x${device.viewportHeight}`,
              timestamp: new Date().toISOString(),
              firstContentfulPaint: null,
              largestContentfulPaint: null,
              speedIndex: null,
              performance: null,
              status: "ERROR",
              error: error.message
            };
            appendMetric(metric);
            return metric;
          } finally {
            if (chrome) await chrome.kill();
          }
        }
      });
      return config;
    }
  }
});
