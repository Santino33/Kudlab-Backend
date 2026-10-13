# Contrato interno propuesto: verificación de responsabilidad

**Estado**: interfaz de integración a validar con Académico y consumidores, no endpoint implementado ni matriz de permisos aprobada. Fuentes: V3 RF-002 fila 3 y RF-004 fila 5, propuestas; A CU03 p. 32; constitución II y IV. Cuentas y sesiones vigentes proceden de `specs/001-gestionar-cuentas-roles/`.

## Participantes

- **Usuarios**: aporta identidad autenticada, cuenta activa y rol vigente comprobados en el servidor; rechaza si faltan o discrepan.
- **Académico**: fuente autoritativa de la asignación vigente entre docente y estudiante/grupo; responde sin confiar en filtros o rol aportados por el cliente.
- **Consumidor**: futura ruta de Académico o Seguimiento (también Tareas cuando procese datos de menores) que solicita permiso **antes** de leer o modificar datos y aplica el ámbito autorizado a su resultado. Una ruta de cuentas no adquiere por esta interfaz acceso a estudiantes.

## Entrada y salida lógica

```text
Entrada: identidad de cuenta autenticada y activa; rol actual; operación
         (consulta o modificación); tipo de objetivo (estudiante o grupo);
         identificador(es) del objetivo solicitado(s) y filtros normalizados.
Salida: permitido + ámbito efectivamente autorizado, o denegado.
```

La decisión se basa en la cuenta y asignaciones **actuales**, no en una captura anterior del panel. Para listados, el consumidor limita los resultados al ámbito verificado y evita exponer datos ajenos en totales, detalles o filtros. Una petición con varios identificadores debe rechazarse o excluir cada objetivo no autorizado sin filtrarlo como dato accesible; la política exacta del endpoint corresponde al contrato del consumidor, que debe especificarse antes de implementarlo.

## Denegaciones

| Situación | Decisión y respuesta al solicitante |
| --- | --- |
| Falta sesión vigente | Denegar; el consumidor comunica necesidad de acceso, sin datos de estudiantes. |
| Cuenta inactiva/pendiente, rol inválido o discrepante | Denegar; respuesta genérica sin revelar existencia de objetivos. |
| Docente no asignado al objetivo o filtro manipulado | Denegar o excluir el objetivo en un listado autorizado, nunca exponerlo. |
| Proveedor de asignaciones no disponible o verificación inconclusa | Denegar toda la solicitud protegida; no sustituir por valores del cliente ni por permiso previo. |

**Consumidores afectados por cambios**: rutas futuras de estudiantes/grupos de Académico, consultas y filtros de Seguimiento, operaciones de Tareas que accedan a datos de menores. Al implementar, cada feature deberá documentar sus entradas, salidas, errores y pruebas de dos docentes/grupos distintos en su propio contrato y cumplir el consentimiento cuando corresponda. No se atribuye a los originales una firma ni ruta técnica concreta.

**Estado de consumidores (2026-10-13)**: ninguno de estos tres módulos expone todavía en este repositorio un consumidor real de datos de estudiantes/grupos. Académico deberá verificar asignación y consentimiento vigente antes de activar estudiantes o habilitar tareas; Seguimiento deberá aplicar el ámbito vigente a consulta, filtros y totales; Tareas deberá verificar asignación y consentimiento vigente antes de que un menor inicie una actividad. Ningún caso puede inferir autorización de un ID/filtro del cliente. `src/modules/usuarios/scope-authorization.ts` solo aporta una decisión denegada por defecto y `src/auth/session-guard.ts` valida de nuevo el estado/rol antes de consultarla; T026/T027 siguen bloqueadas hasta tener proveedor y consumidor reales.
