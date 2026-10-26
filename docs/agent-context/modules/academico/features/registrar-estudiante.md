# RF-005 (V3, propuesta): registrar estudiante

## Aplicación a este backend

**Diseño no implementado.** Académico registra un participante asociado a grupo/responsabilidad docente, no una cuenta de Usuarios. La API recibe datos mínimos autorizados y aplica unicidad/ámbito/consentimiento; la pantalla es otro proyecto. No crear contraseña/correo de acceso para el menor ni exigir documento personal si la identificación mínima aprobada permite otro código.

**Antes de diseñar contrato:** AC-01/AC-02 en [pendientes](../../../unresolved-issues.md): campos/identificador, permisos y si se persiste un registro pendiente antes de consentimiento. D p. 6 propone pendiente persistido, mientras el diagrama de actividades bloquea activación antes de guardar/activar; no resolverlo silenciosamente. Es independiente de que la activación y el inicio exijan consentimiento vigente.

**Pruebas del API:** registro único, campos inválidos, grupo ajeno, fallo de persistencia y consentimiento ausente sin activación. La referencia HTTP 400 de D no define por sí sola toda la respuesta. Ver [modelo y referencias de docente](../domain-model.md).

## Flujo original y evidencia

**Propósito:** alta de participante de tercero con identificador único y docente/grupo responsable; no habilitarlo sin consentimiento vigente. Usuario autorizado docente/administrador según [A §7.1 p. 40](../../../../original/3%20ANALISIS%20DEL%20PROYECTO.docx.pdf), [V3 RF-005](../../../../original/requisitos_V3.xlsx). Datos: nombre, identificación, grado, grupo, docente asignado (D flujo A p. 6); el [ERD](../domain-model.md) en cambio solo modela `student_code`, nombres, grupo, `is_active`.

**Secuencia:** abrir formulario → completar datos mínimos → validar campos obligatorios/formato y no duplicación → asociar grupo/docente → registrar/consultar evidencia de consentimiento → guardar activo si vigente; sin evidencia conservar pendiente/inactivo según D flujo A (el diagrama de actividades finaliza no activo). [Actividad original](../../../../original/DIAGRAMAS-ANALISIS/DIAGRAMAS/05-actividades/02-Actividades-gestion-estudiantes/02-Actividades-gestion-estudiantes), [D §2.2 pp. 5–6](../../../../original/DESCRIPCI%C3%93N%20DE%20DISE%C3%91O%20DE%20SOFTWARE.docx.pdf). Faltante/formato incorrecto/duplicado → no guardar alta válida; D especifica HTTP 400 para validación, **sin ruta**. **Aceptación/pruebas:** registro único asociado a grupo/docente, rechazo de duplicado y faltante, ausencia de consentimiento no activa ni permite tarea; probar con dos docentes. Pendiente: si puede persistirse antes de consentimiento, identificador y campos mínimos aprobados; [consentimiento](consentimiento.md), [cuestiones](../../../unresolved-issues.md).
