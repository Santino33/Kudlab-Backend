# RF-024 (V3, propuesta): matriz de observaciones del grupo

## Aplicación a este backend y al frontend

**Diseño no implementado.** La matriz es interfaz del frontend; Seguimiento recibe/registra observaciones reutilizando RF-023. No crear automáticamente una entidad «observación grupal» separada ni un importador de archivos. Debe validar cada estudiante/campo y su ámbito en servidor.

**Bloqueo SE-02:** contrato de lote vs peticiones individuales, atomicidad/parcialidad, identificación de fila/errores y duplicados/reintentos. V3 permite guardar registros válidos y señalar incompletos, pero no determina el mecanismo transaccional. No declarar éxito de todas las filas si solo algunas persistieron.

**Pruebas del API:** mezcla válido/incompleto/ajeno, fallo parcial o total según contrato, reenvío y escala compartida. Ver [observaciones](observaciones.md) y [pendientes](../../../unresolved-issues.md). El flujo de interfaz siguiente no fija por sí solo un endpoint masivo.

## Flujo original de plataforma y evidencia

**Actor:** docente con grupo asignado; objetivo: registrar secuencialmente observaciones de varios alumnos sin reconfigurar sesión por estudiante, aplicando mismos campos/escala de RF-023. [V3 RF-024](../../../../original/requisitos_V3.xlsx), [A §2.2.2 pp. 9–10](../../../../original/3%20ANALISIS%20DEL%20PROYECTO.docx.pdf).

**Flujo:** consultar grupo autorizado → mostrar matriz de alumnos/observaciones → completar entradas con escala/fecha/autor/periodo según [observaciones](observaciones.md) → validar cada fila → guardar válidas, señalar incompletas sin tratarlas como completas. Alumno fuera de grupo → denegar; fallo al guardar → no declarar éxito sobre fila afectada. **Verificación:** registrar varios miembros sin cambiar sesión; fila inválida claramente distinguida y no persiste como completa; docente de otro grupo no registra; repetir carga para detectar duplicados (política por definir). Pruebas: mezcla de filas válidas/inválidas, grupo ajeno y fallo de guardado. V3 no especifica importación de archivo ni atomicidad total; no inferir. Modelo [observaciones](../domain-model.md).
