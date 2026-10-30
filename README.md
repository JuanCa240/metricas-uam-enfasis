# Métricas web UAM con Cypress y Lighthouse

Proyecto para evaluar el rendimiento de páginas institucionales de la Universidad Autónoma de Manizales mediante Cypress y Lighthouse, almacenar las mediciones en JSON, visualizarlas en un informe web y sincronizar los resultados con Google Sheets.

El proyecto permite ejecutar auditorías en perfiles móvil y escritorio, conservar un historial de resultados y programar ejecuciones automáticas.

## Requisitos

- Node.js 22 o 24 y npm.
- Google Chrome instalado.
- Proyecto de Google Cloud con Google Sheets API habilitada.
- Cuenta de servicio de Google con permisos de Editor en la hoja de cálculo.

Documentación oficial de instalación de Cypress: https://docs.cypress.io/app/get-started/install-cypress

## 1. Instalación

En la terminal, dentro de la carpeta del proyecto, ejecuta:

```bash
npm install
npx cypress verify
```

Si Cypress no puede descargar su ejecutable, revisa el mensaje de error y la documentación oficial de instalación.

## 2. Configuración de Google Sheets

1. Copia `.env.example` como `.env`, si el archivo de ejemplo está disponible.
2. Configura `SPREADSHEET_ID` con el identificador de la hoja de cálculo.
3. Configura `SHEET_NAME` con el nombre exacto de la pestaña de resultados.
4. Guarda el archivo de credenciales de la cuenta de servicio en `credentials/google-service-account.json`.
5. Comparte la hoja de cálculo con el correo `client_email` de las credenciales y concede permisos de Editor.
6. Verifica que Google Sheets API esté habilitada en Google Cloud.

El archivo `.env` debe contener la configuración necesaria para acceder a Google Sheets. No publiques las credenciales ni el archivo `.env`.

**Seguridad:** si una clave privada se expone en un chat o repositorio, revócala y genera una nueva.

## 3. Ejecutar las pruebas de Lighthouse

Para ejecutar todas las pruebas:

```bash
npm test
```

Para ejecutar las auditorías por perfil:

```bash
npm run test:mobile
npm run test:desktop
```

Las páginas evaluadas se configuran en:

`cypress/fixtures/pages.json`

Los perfiles de los dispositivos se configuran en:

`cypress/fixtures/devices.json`

Cypress ejecuta las pruebas definidas en `cypress/e2e/lighthouse.cy.js` y utiliza Lighthouse para medir el rendimiento de cada página.

Las mediciones se almacenan en:

`cypress/fixtures/lighthouse-metrics.json`

El archivo conserva el historial de las ejecuciones. Cuando una auditoría falla, el sistema puede registrar el estado `ERROR` y el mensaje correspondiente, según el punto en el que se produzca el error.

Lighthouse requiere Chrome y puede tardar varios minutos. Las puntuaciones pueden variar entre ejecuciones debido a las condiciones de carga y de red.

## 4. Sincronización con Google Sheets

Después de ejecutar las pruebas, utiliza:

```bash
npm run sheets
```

El script `scripts/push-to-sheet.js` lee las mediciones del JSON y agrega a Google Sheets los registros que no identifica como duplicados.

La sincronización conserva las filas existentes y evita volver a insertar registros que coincidan con los criterios de comparación del script.

La pestaña utilizada se configura mediante `SHEET_NAME`. Por defecto, el nombre es `Resultados`.

Las columnas incluyen:

- URL evaluada.
- Tipo de prueba.
- Dispositivo y resolución.
- Fecha y hora de la medición.
- First Contentful Paint (FCP).
- Largest Contentful Paint (LCP).
- Speed Index.
- Puntuación de Performance.
- Estado y mensaje de error.

Actualmente, los tiempos se almacenan en el JSON y se presentan en Google Sheets en segundos. La puntuación de Performance se expresa entre 0 y 100.

## 5. Informe web

El proyecto incluye un comando para servir los archivos del informe web:

```bash
npm run report
```

Después, abre en el navegador:

http://localhost:8080

El informe debe utilizar las mediciones disponibles para presentar los resultados de rendimiento y sus clasificaciones.

La implementación del informe debe verificarse para confirmar que muestre los datos actuales, las comparaciones entre ejecuciones, las diferencias entre dispositivos y los errores registrados.

## 6. Programación automática

La configuración de los jobs se encuentra en:

`config/schedule.js`

Actualmente se han definido dos jobs independientes:

| Job | Perfil | Frecuencia configurada | Hora de Colombia |
|---|---|---|---|
| `auditoria-movil-diaria` | Móvil | Diaria | 08:00 |
| `auditoria-escritorio-semanal` | Escritorio | Semanal, los lunes | 09:00 |

Los horarios son configurables. Cada job incluye un identificador, una fecha de inicio, una expresión cron, una zona horaria, un perfil de dispositivo y una selección de páginas.

La zona horaria configurada es `America/Bogota`.

Los jobs están deshabilitados inicialmente para evitar ejecuciones inesperadas. Para activar uno, cambia su propiedad `enabled` a `true` después de verificar su configuración.

Para iniciar el programador:

```bash
npm run scheduler
```

El script `scripts/scheduler.js` utiliza `node-cron` para registrar los jobs habilitados. Cuando llega el horario configurado, ejecuta Cypress con el perfil seleccionado y después intenta sincronizar las mediciones con Google Sheets.

**Importante:** el programador local requiere que el proceso Node.js permanezca activo y que el equipo esté encendido. Si el proceso se detiene, las ejecuciones programadas no se recuperan automáticamente.

Para ejecutar las auditorías sin depender de que el computador personal permanezca encendido, se puede evaluar una solución de integración continua como GitHub Actions.

Antes de considerar terminada la automatización, deben probarse ambos jobs de forma independiente y comprobarse la actualización del JSON y de Google Sheets.

## 7. Umbrales de rendimiento

Los umbrales se encuentran configurados en:

- `config/thresholds.js`
- `cypress/fixtures/thresholds.json`

Ambos archivos deben mantenerse coherentes con las unidades y los valores utilizados por el sistema.

Los umbrales de referencia son:

| Métrica | Bueno | Por mejorar | Deficiente |
|---|---|---|---|
| FCP | ≤ 1,8 s | > 1,8 y ≤ 3,0 s | > 3,0 s |
| LCP | ≤ 2,5 s | > 2,5 y ≤ 4,0 s | > 4,0 s |
| Speed Index | ≤ 3,4 s | > 3,4 y ≤ 5,8 s | > 5,8 s |
| Performance | 90–100 | 50–89 | 0–49 |

Las clasificaciones deben utilizar intervalos sin solapamientos y mostrar etiquetas, además de señales visuales.

## 8. Estructura del proyecto

```text
config/
  schedule.js
  thresholds.js

credentials/
  google-service-account.json

cypress/
  e2e/
    lighthouse.cy.js
  fixtures/
    devices.json
    pages.json
    thresholds.json
    lighthouse-metrics.json
  support/
    e2e.js

scripts/
  push-to-sheet.js
  scheduler.js

report/
  index.html

cypress.config.js
.env
.env.example
.gitignore
package.json
package-lock.json
README.md
```

El archivo de credenciales y `.env` son locales y no deben publicarse en el repositorio.

## 9. Validación y evidencias

Para validar el funcionamiento del proyecto, se debe comprobar que:

1. Se evalúen al menos tres páginas institucionales.
2. Las auditorías se ejecuten en móvil y escritorio.
3. Las mediciones reales de Lighthouse se almacenen en JSON y se conserve el historial.
4. Google Sheets reciba los registros nuevos sin duplicar los existentes.
5. Los jobs móvil y escritorio se ejecuten de forma independiente según su programación.
6. El informe visual refleje las mediciones actuales.
7. Se registren los errores de ejecución y se documenten las recomendaciones de mejora.
8. El repositorio incluya instrucciones de instalación, configuración y ejecución.
9. Existan evidencias de las ejecuciones y del trabajo realizado por los integrantes.

Las URL, los dispositivos y los jobs deben poder ampliarse mediante configuración, evitando duplicar la lógica principal de las pruebas.

## 10. Consideraciones finales

El rendimiento puede variar entre ejecuciones. Para realizar comparaciones útiles, se recomienda comparar mediciones obtenidas bajo condiciones equivalentes y repetir las auditorías cuando sea necesario.

La automatización se considera validada cuando los jobs ejecutan las pruebas programadas, actualizan el historial JSON y reflejan los nuevos resultados en Google Sheets sin intervención manual.