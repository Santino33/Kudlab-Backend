# Feature propuesta: documentar la API con OpenAPI y Swagger UI

**Resultado:** que desarrolladores puedan descubrir y consumir la API implementada de Usuarios desde una especificación OpenAPI y una interfaz Swagger UI, con contratos claros y verificables. Es una tarea de documentación; **no añade endpoints ni cambia su comportamiento**. La documentación debe reflejar el código actual, no presentar como implementado lo que solo aparece en propuestas o contratos planificados.

## Alcance

- Inventariar las rutas realmente montadas en `src/app.ts` y sus routers, y documentar método, ruta, propósito, parámetros, cuerpo, respuestas y autorización.
- Incluir las rutas de autenticación Better Auth que la aplicación permite, las cuentas del personal, invitaciones, cambios de correo, solicitudes de ascenso y recuperación de contraseña.
- Explicar cookies/sesiones y credenciales requeridas; distinguir sesión persistida de JWT de interoperabilidad. Indicar qué rutas son públicas, cuáles requieren sesión activa y cuáles requieren rol ADMIN.
- Documentar validación de entradas, paginación/filtros, estados y códigos de error observables, usando los esquemas y servicios actuales como fuente de verdad.
- Publicar la especificación OpenAPI y habilitar Swagger UI según el patrón/configuración del proyecto, sin exponer secretos ni datos reales.

## Buenas prácticas y criterios de aceptación

1. Cada operación tiene `summary` y descripción concisas, `operationId` único, tags consistentes y referencias a esquemas reutilizables cuando corresponda.
2. Cada parámetro y campo indica tipo, obligatoriedad, formato, restricciones y ejemplo ficticio válido; cuerpos y respuestas usan esquemas explícitos, incluidos los errores relevantes.
3. Se documentan respuestas de éxito y fallos esperables con sus códigos HTTP reales; se aclaran efectos importantes como revocación de sesiones, consumo/vencimiento de tokens y respuesta neutra de recuperación.
4. Se describe la seguridad por operación. No presentar como Bearer JWT una ruta que valida cookie/sesión persistida; los tokens de un solo uso se documentan como entradas de confirmación, no como sesión.
5. Los ejemplos son sintéticos y no contienen credenciales, tokens activos, correos personales ni información de menores.
6. La especificación valida con una herramienta OpenAPI compatible con la versión declarada y se puede abrir en Swagger UI. Las rutas y contratos se contrastan con pruebas o implementación para evitar documentar supuestos como hechos.
7. Las rutas no implementadas (por ejemplo, estudiantes, grupos y tareas) quedan claramente fuera del contrato actual. Los contratos OpenAPI existentes etiquetados como planificados/propuestos no se copian como si fueran implementados.
8. Se indica en el repositorio dónde consultar la especificación y la UI, y cómo actualizar/verificar la documentación durante cambios futuros de endpoints.

## Fuera de alcance

No implementar endpoints, cambiar autenticación/autorización, completar contratos futuros ni adoptar una herramienta de generación automática que obligue a refactorizar routers. Elegir el formato/ubicación y la forma de servir Swagger UI siguiendo las dependencias y convenciones ya instaladas.

## Fuentes

Código montado en `src/app.ts` y routers de `src/modules/usuarios/`; contratos existentes bajo `specs/*/contracts/` (algunos son propuestas); catálogo actual descrito en la conversación/documentación del módulo. Antes de cerrar el inventario, volver a contrastarlo con el código, porque puede haber cambiado.
