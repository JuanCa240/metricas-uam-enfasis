require("dotenv").config();

const cron = require("node-cron");
const { spawn } = require("child_process");
const path = require("path");
const jobs = require("../config/schedule");

function runCommand(command, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: path.join(__dirname, ".."),
      stdio: "inherit",
      shell: process.platform === "win32",
      env: { ...process.env, ...env }
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} terminó con código ${code}`));
    });
  });
}

async function executeJob(job) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: job.timezone });
  if (job.startDate && today < job.startDate) {
    console.log(`[${job.id}] Todavía no llega la fecha de inicio (${job.startDate}).`);
    return;
  }

  console.log(`[${job.id}] Iniciando perfil ${job.deviceProfile}...`);
  await runCommand("npx", ["cypress", "run"], {
    CYPRESS_DEVICE_PROFILE: job.deviceProfile,
    CYPRESS_PAGE_FILTER: Array.isArray(job.pages) ? JSON.stringify(job.pages) : (job.pages || "all")
  })
    .catch((error) => { throw error; });
  await runCommand("node", ["scripts/push-to-sheet.js"]);
  console.log(`[${job.id}] Finalizado.`);
}

for (const job of jobs) {
  if (!job.enabled) {
    console.log(`[${job.id}] Deshabilitado; no se programa.`);
    continue;
  }
  if (!cron.validate(job.cron)) {
    console.error(`[${job.id}] Expresión cron inválida: ${job.cron}`);
    continue;
  }
  cron.schedule(job.cron, () => {
    executeJob(job).catch((error) => console.error(`[${job.id}] Error:`, error.message));
  }, { timezone: job.timezone, name: job.id, noOverlap: true });
  console.log(`[${job.id}] Programado: ${job.cron} (${job.timezone}), perfil ${job.deviceProfile}`);
}

console.log("Scheduler activo. Mantén esta terminal abierta para que se ejecuten los jobs.");
