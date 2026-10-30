// Horarios de ejemplo. Ajusta enabled, cron, startDate y perfiles según el grupo.
// node-cron ejecuta tareas mientras el proceso Node.js permanezca activo.

module.exports = [
  {
    id: "auditoria-movil-diaria",
    enabled: false,
    startDate: "2026-10-29",
    cron: "0 8 * * *",
    timezone: "America/Bogota",
    deviceProfile: "mobile",
    pages: "all",
    frequency: "daily"
  },
  {
    id: "auditoria-escritorio-semanal",
    enabled: false,
    startDate: "2026-10-29",
    cron: "0 9 * * 1",
    timezone: "America/Bogota",
    deviceProfile: "desktop",
    pages: "all",
    frequency: "weekly"
  }
];
