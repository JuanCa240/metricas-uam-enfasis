require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const JSON_PATH = path.join(
  __dirname,
  "..",
  "cypress",
  "fixtures",
  "lighthouse-metrics.json"
);

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = process.env.SHEET_NAME || "Resultados";

const HEADERS = [
  "url",
  "type",
  "device",
  "screenEmulation",
  "timestamp",
  "firstContentfulPaint (s)",
  "largestContentfulPaint (s)",
  "speedIndex (s)",
  "performance (score)",
  "status",
  "error"
];

function formatTimestamp(timestamp) {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return timestamp || "";
  }

  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).format(date);
}


// duplicados
function normalizeRow(row) {
  return JSON.stringify(
    Array.from({ length: HEADERS.length }, (_, index) =>
      String(row[index] ?? "").trim()
    )
  );
}

function createRows(results) {
  return results.map((r) => [
    r.url || "",
    r.type || "",
    r.device || "",
    r.screenEmulation || "",
    formatTimestamp(r.timestamp),
    r.firstContentfulPaint ?? "",
    r.largestContentfulPaint ?? "",
    r.speedIndex ?? "",
    r.performance ?? "",
    r.status || "",
    r.error || ""
  ]);
}

async function pushToSheets() {
  // 1. Validar la configuración.
  if (!SPREADSHEET_ID) {
    throw new Error("Falta SPREADSHEET_ID en el archivo .env");
  }

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error(
      "Falta GOOGLE_APPLICATION_CREDENTIALS en el archivo .env"
    );
  }

  if (!fs.existsSync(JSON_PATH)) {
    throw new Error(`No existe el archivo: ${JSON_PATH}`);
  }

  // 2. Leer el historial local.
  const results = JSON.parse(
    fs.readFileSync(JSON_PATH, "utf8")
  );

  if (!Array.isArray(results)) {
    throw new Error("El JSON de métricas debe ser un arreglo.");
  }

  // No modificar Google Sheets si todavía no hay mediciones.
  if (results.length === 0) {
    console.log(
      "No hay mediciones nuevas. Google Sheets no se ha modificado."
    );
    return;
  }

  // 3. Validar las credenciales.
  const keyFile = path.resolve(
    process.env.GOOGLE_APPLICATION_CREDENTIALS
  );

  if (!fs.existsSync(keyFile)) {
    throw new Error(
      `No se encontró el archivo de credenciales: ${keyFile}`
    );
  }

  // 4. Conectarse a Google Sheets.
  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets"
    ]
  });

  const authClient = await auth.getClient();

  const sheets = google.sheets({
    version: "v4",
    auth: authClient
  });

  const range = `'${SHEET_NAME}'!A1:K1000`;  // obtener el nombre exacto de la pestaña y utilizar un rango explícito,

  // 5. Leer los datos existentes SIN borrarlos.
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range
  });

  const existingValues = response.data.values || [];

  // 6. Si la hoja está vacía, crear los encabezados.
  if (existingValues.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_NAME}'!A1:K1000`,
      valueInputOption: "RAW",
      requestBody: {
        values: [HEADERS]
      }
    });

    existingValues.push(HEADERS);
  } else {
    // No modificar una hoja cuyo formato no reconocemos.
    const existingHeaders = existingValues[0]
      .slice(0, HEADERS.length)
      .map((value) => String(value ?? "").trim());

      console.log("Encabezados esperados:", HEADERS);
console.log("Encabezados encontrados:", existingHeaders);


    const headersMatch =
      HEADERS.length === existingHeaders.length &&
      HEADERS.every(
        (header, index) => header === existingHeaders[index]
      );

    if (!headersMatch) {
      throw new Error(
        `La pestaña "${SHEET_NAME}" ya contiene datos, ` +
        "pero sus encabezados no coinciden con los del proyecto. " +
        "No se ha modificado ni borrado ningún dato."
      );
    }
  }

  // 7. Identificar los registros que ya existen.
  const existingRows = existingValues.slice(1);

  const existingRecords = new Set(
    existingRows.map((row) => normalizeRow(row))
  );

  // 8. Preparar únicamente las mediciones que no estén registradas.
  const allNewRows = createRows(results);

  const uniqueNewRows = [];
  const pendingRecords = new Set();

  for (const row of allNewRows) {
    const signature = normalizeRow(row);

    if (
      !existingRecords.has(signature) &&
      !pendingRecords.has(signature)
    ) {
      uniqueNewRows.push(row);
      pendingRecords.add(signature);
    }
  }

  // 9. Agregar los registros nuevos al final de la tabla.
  // No se utiliza values.clear() ni se sobrescriben filas existentes.
  if (uniqueNewRows.length > 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_NAME}'!A:K`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: uniqueNewRows
      }
    });
  }

  console.log("Sincronización completada.");
  console.log(`Mediciones leídas del JSON: ${results.length}`);
  console.log(`Registros nuevos agregados: ${uniqueNewRows.length}`);
  console.log(
    `Registros omitidos por estar duplicados: ${
      allNewRows.length - uniqueNewRows.length
    }`
  );
}

pushToSheets().catch((error) => {
  console.error(
    "Error al actualizar Google Sheets:",
    error.message
  );

  process.exitCode = 1;
});