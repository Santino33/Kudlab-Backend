# Recursos de regresión OpenAPI

- `accounts.openapi.yaml`, `validation.openapi.yaml` y `auth.openapi.yaml` conservan sin cambios los contratos usados por las pruebas de cuentas, acceso, autenticación y recuperación.
- `operations.json` contiene las 58 combinaciones `método ruta operationId` esperadas por la prueba documental. Se extrajo de la tabla independiente que ya utilizaba la prueba, no del YAML que se valida. La lista debe revisarse explícitamente cuando cambie el alcance autorizado; no regenerarla automáticamente desde el documento bajo prueba.

Son fixtures de pruebas, no el catálogo operativo. El contrato publicado sigue en `docs/api/openapi.yaml`. Los tests no necesitan documentación de planificación, skills ni archivos externos al checkout.
