# Académico: estudiantes, grupos, consentimiento y notas

## Responsabilidad del backend

**Diseño, sin módulo implementado en esta base.** Es propietario del participante (no cuenta de acceso), grupo, responsabilidad docente, consentimiento/evidencia y nota escolar. Usuarios autentica al profesor; Académico determina qué estudiantes/grupos están bajo su responsabilidad. No asigna juegos ni conserva sus eventos; no escribe observaciones/anotaciones, que pertenecen a Seguimiento.

### Entradas, salidas y límites

- Recibe del profesor autorizado datos mínimos del participante, evidencia/metadatos legales y notas; no recopilar identificación sensible solo porque un ejemplo de D la menciona.
- Provee a Tareas comprobaciones actuales de estado/consentimiento y a otros módulos la decisión de ámbito; no duplicar esos estados como una segunda fuente de verdad.
- Provee ficha y notas a Seguimiento. Inactivar no es borrar ni resolver automáticamente una solicitud legal de retiro.
- El [proveedor de ámbito existente](../../../../src/modules/usuarios/shared/scope-authorization.ts) usa ID de cuenta de negocio y deniega sin proveedor. Definir operaciones académicas y permisos ADMIN antes de conectarlo; no asumir acceso irrestricto.

### Estructura recomendada (no creada)

Dentro de `src/modules/academico/`: `students/`, `groups/`, `consents/`, `academic-notes/`; rutas/servicios por feature conforme a la [guía](../../implementation-guide.md). La gestión de grupos y responsabilidad docente necesita especificación propia: `groups` no es solo un filtro de consulta. Esquema/migraciones en `src/db/`, no copias del ERD dentro de cada feature.

### Antes de implementar

Resolver campos/identificador mínimos; permisos de gestión de grupos y transferencias/historia; referencia de docente a cuenta vs identidad; estados/vigencia/revocación y conservación de consentimiento. La escala institucional y unicidad de notas bloquean **notas**, no toda gestión de grupos. No fijar `score NUMERIC(3,2)` como escala institucional. Estados temporales de matrícula y consentimiento deben mantenerse distintos. Ver [pendientes AC-01…03](../../unresolved-issues.md).

Probar dos profesores con grupos distintos, consulta por ID ajeno, revocación entre asignación e inicio, inactivación sin borrar historia y fallo del proveedor de ámbito. Los contratos HTTP aún deben especificarse: no hay endpoints académicos implementados aquí.

## Referencia funcional de las fuentes

1. **Propósito:** identificar participantes, responsabilidad docente, evidencia de consentimiento y notas por área/periodo (V3 RF-005…009).
2. **Alcance/límites:** registro, edición, inactivación y consulta; consentimiento y notas. No define PIAR ni accede a sistema académico externo ([contexto PNG](../../../original/DIAGRAMAS-ANALISIS/DIAGRAMAS/01-Contexto/contextoGeneral/01-contexto-general.png)).
3. **Actores/permisos:** docente registra/edita/consulta su ámbito; administrador consulta, inactiva y gestiona evidencia según A §7.1 p. 40; V3 exige usuario autorizado y validación del ámbito en servidor. Acudiente aporta consentimiento externamente.
4. **Vocabulario:** estudiante activo ≠ consentimiento vigente; grupo vincula docente/año; nota académica no es indicador cognitivo.
5. **Reglas:** datos mínimos e identificación sin duplicados; no activar ni comenzar tarea sin consentimiento vigente; revocación impide nuevas tareas; inactivar conserva historial e impide asignar/iniciar; notas usan escala institucional por aprobar (V3 RF-005…009).
6. **Entidades:** `groups` 1:N `students` y asignaciones; estudiante 1:1 consentimiento según ERD, 1:N notas, observaciones y sesiones; [modelo](domain-model.md).
7. **Flujo:** datos → validación → evidencia → activar o pendiente → consulta/edición/inactivación; nota: seleccionar estudiante/área/periodo → validar escala y ámbito → guardar/consultar ([actividad draw.io](../../../original/DIAGRAMAS-ANALISIS/DIAGRAMAS/05-actividades/02-Actividades-gestion-estudiantes/02-Actividades-gestion-estudiantes)).
8. **Integración:** Usuarios autoriza docente; Tareas bloquea sin autorización legal; Seguimiento/Evolución integra notas y referencia estudiante; Cloudflare R2 propuesto almacena evidencia, BD metadatos ([PUML](../../../original/C4/UML/integracionCloudflare.puml)).
9. **Arquitectura/seguridad:** servidor debe controlar consentimiento en activación e inicio (V3 RF-008, D ADR-03); evidencia restringida, minimizar PII; D §2.2 p. 6 documenta HTTP 400 en validación del registro, sin ruta.
10. **Dependencias:** definición de datos mínimos, escala de notas, vigencia/revocación, alcance de grupos y conservación pendiente de aprobación.
11. **Features:** [registro](features/registrar-estudiante.md), [actualización/inactivación](features/actualizar-inactivar-estudiante.md), [consulta](features/consultar-estudiantes.md), [consentimiento](features/consentimiento.md), [notas](features/notas-academicas.md).
12. **Fuentes:** [V3 RF-005…009](../../../original/requisitos_V3.xlsx), [A §7.1 p. 40 y §7.4 pp. 46–47](../../../original/3%20ANALISIS%20DEL%20PROYECTO.docx.pdf), [D §§2.2, 3, 6 pp. 5–10, 14–15](../../../original/DESCRIPCI%C3%93N%20DE%20DISE%C3%91O%20DE%20SOFTWARE.docx.pdf), [CU PNG](../../../original/DIAGRAMAS-ANALISIS/DIAGRAMAS/02-casos-de-uso/02-cu-gestion-estudiantes/02-cu-gestion-estudiantes.png).
