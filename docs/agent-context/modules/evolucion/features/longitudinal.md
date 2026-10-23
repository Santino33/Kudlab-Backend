# RF-020 (V3, propuesta): evolución individual

## Aplicación a este backend

**Diseño no implementado.** Evolución construye historia de resultados con condiciones/versiones y limitaciones de comparación; Seguimiento la integra con otras fuentes y el frontend la representa. No recalcular cada punto con reglas actuales borrando las versiones que lo originaron.

**Bloqueo EV-03:** equivalencias entre tarea/configuración/regla/carga/dispositivo/incidencias según metodología. Igual código TG o igual unidad no garantiza comparabilidad. Se puede consultar un valor aislado calculable aunque no se pueda afirmar tendencia; no rellenar sesiones ausentes con cero.

**Pruebas del API:** orden cronológico estable, traza a origen, límite de ámbito, sesiones con versiones/cargas diferentes y ausencia/insuficiencia; no comparar como equivalentes sin evidencia. Definir filtros/orden/paginación y permisos con Seguimiento sin duplicar reglas ni aprobar exportación implícitamente.

## Flujo original y evidencia

**Actor:** sistema ordena sesiones; docente autorizado interpreta la trayectoria de su alumno. [V3 RF-020](../../../../original/requisitos_V3.xlsx), [F §§6.4, 6.14, 6.24 pp. 54–55, 58–59, 62](../../../../original/Fundamento%20teorico.docx.pdf), [A CU04 pp. 33–34](../../../../original/3%20ANALISIS%20DEL%20PROYECTO.docx.pdf).

**Flujo:** consultar estudiante propio → reunir indicadores por fecha/sesión/tarea → mostrar puntos ordenados y trazables a versión de configuración/regla y condiciones → comprobar comparabilidad (misma tarea, dificultad, cantidad de estímulos, condiciones, incidencia, versiones) → comparar solo si criterios metodológicos aprobados se cumplen; de otro modo presentar limitación y valores aislados si existen. **Criterios/pruebas:** serie cronológica con origen recuperable; sesiones heterogéneas o afectadas no se trazan como tendencia equivalente; sin datos mostrar ausencia explícita; acceso ajeno denegado. Pruebas: dos sesiones comparables, versión de tarea diferente, distinta carga, sesión interrumpida y datos faltantes. [Indicadores](../domain-model.md), [visualización](../../seguimiento/features/visualizar-filtrar.md). Regla exacta de comparabilidad pendiente V3 D-05.
