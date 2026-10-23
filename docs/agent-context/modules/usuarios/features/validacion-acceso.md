# RF-002 (V3, propuesta): validación de perfil y acceso

## Implementación actual y responsabilidad

Reglas observadas en [accounts.validation.ts](../../../../../src/modules/usuarios/shared/accounts.validation.ts): nombre recortado de 1–200 caracteres; correo válido normalizado a minúsculas y dominio terminado en `.edu.co`; contraseña 8–128 con mayúscula, minúscula y número. Alta admite rol TEACHER; edición solo nombre/correo y al menos un campo. No recopilar otros datos de profesor por deducción del ERD.

Estas validaciones no sustituyen autenticación/ámbito. La unicidad y sincronía de correo/cuenta/identidad también se protegen en servicios y restricciones de BD. Cambiar correo tiene confirmación propia. No exponer todos los endpoints de Better Auth para eludir las reglas de negocio.

## Contratos y pruebas

Consultar [validation.openapi.yaml](../../../../../specs/002-validar-perfil-acceso/contracts/validation.openapi.yaml), [esquema real](../../../../../src/db/schema/accounts.ts) y [pruebas de política](../../../../../tests/unit/identity-policy.test.ts). Verificar obligatorios, campos no admitidos, límite/formato, normalización/duplicados, cambio de correo y llamadas sin permiso. No sustituir errores/respuestas actuales por ejemplos históricos sin acuerdo.

## Antecedente original (campos/política entonces no definidos)

**Actor/precondición:** administrador autenticado edita/crea; servidor valida también toda operación protegida aunque se omita la UI. **Entradas documentadas:** datos obligatorios de perfil (lista no cerrada), correo institucional con formato válido y credencial acorde a política aún no definida. [V3 RF-002](../../../../original/requisitos_V3.xlsx), [A CU01-S1/S2 pp. 27–29](../../../../original/3%20ANALISIS%20DEL%20PROYECTO.docx.pdf); [modelo](../domain-model.md).

**Flujo:** recibir datos → validar obligatorios/formato/política y unicidad al cambiar identificador → verificar rol y ámbito en servidor → solo entonces crear/actualizar o ejecutar consulta. Faltante/formato incorrecto/política incumplida o petición directa sin permiso → rechazo sin cambios ni exposición. Criterios: perfiles incompletos, correo inválido y credenciales contrarias a política no se guardan; petición directa no autorizada se deniega. Pruebas: falta campo, correo inválido, identificador duplicado, solicitud directa de otro rol/grupo; repetir con UI omitida. **Pendiente:** campos concretos, patrón de correo y contraseña. Dependencia [RF-004](autorizacion.md); no hay ruta ni códigos HTTP confirmados para esta operación.
