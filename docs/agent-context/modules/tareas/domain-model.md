# Modelo de tarea y datos de ejecución

**Estado:** esquema histórico, no tablas existentes. Tareas es propietario de tareas/asignaciones/sesiones/evidencia; Evolución consume esa evidencia sin modificarla. El servicio externo ejecuta los juegos; los datos siguientes no definen su contrato JSON.

| Tabla ERD | Atributos explícitos | Relaciones / observaciones |
| --- | --- | --- |
| `tasks` | `id VARCHAR(20) PK` TG-00…06; `title VARCHAR(100)`, `paradigm_type VARCHAR(100)`, `is_evaluative BOOLEAN`, `config_version INT`, `kud_assets_r2_prefix VARCHAR(255)` | 1:N asignaciones; versión actual no garantiza versiones históricas. |
| `task_assignments` | `id UUID PK`, `task_id VARCHAR(20) FK`, `group_id UUID FK`, `teacher_id UUID FK`, `start_date/end_date TIMESTAMP`, `max_attempts INT DEFAULT 2` | docente/grupo/tarea 1:N asignaciones; V3 RF-015 propone también individuo, ausente en ERD. |
| `task_sessions` | `id UUID PK`, `assignment_id/student_id UUID FK`, `attempt_number INT`, `status VARCHAR(30)`, `started_at/finished_at TIMESTAMP` | asignación/estudiante 1:N sesiones; valores de status **no enumerados completamente**. |
| `raw_events` | `id BIGINT PK AUTOINCREMENT`, `session_id UUID FK`, `trial_number INT`, `event_type/stimulus_type VARCHAR(50)`, `reaction_time_ms INT`, `is_correct BOOLEAN`, `timestamp_client TIMESTAMP(3)` | sesión 1:N eventos; TG-02…05 necesitan respuestas, secuencias, condiciones y dispositivos adicionales no representados en este ERD. |

F §3.7 pp. 20–21 especifica jerarquía conceptual **estudiante → sesión → bloque → tarea → ensayo → respuesta → indicador**, no necesariamente tablas. F §§5.3–5.4 pp. 42–44: tiempo válido = respuesta registrada − presentación efectiva; omisión solo si estímulo y ventana válidos sin incidencia técnica; no número mínimo universal de ensayos. Estado de sesión completada/interrumpida/abandonada/afectada por incidencia (F §6.12 p. 58); diagrama PNG añade Asignada, Autenticando, InstruccionesPresentadas, EnEjecución, LímiteAlcanzado, Finalizada y Consolidada; no es enum persistido. [DBML líneas 100–138, 163–168](../../../original/DIAGRAMAS-ANALISIS/DIAGRAMAS/03-modelo-datos/01-modelo-logico/esquema.dbml), [estado PNG](../../../original/DIAGRAMAS-ANALISIS/DIAGRAMAS/04-estados/01-estado-seccion-tarea/01-estado-sesion-tarea.png).

## Vacíos que no deben convertirse en supuestos

| Decisión | Consecuencia para diseño/contrato |
| --- | --- |
| Sesión de batería vs intento de tarea | F agrupa varios bloques; ERD vincula `task_sessions` a una asignación de una tarea. Definir relación e IDs antes de aceptar un paquete de batería completo. |
| Asignación individual/grupal | ERD solo tiene grupo; V3 RF-015 admite individuo. Acordar destinatarios y si una asignación grupal fija miembros o usa el grupo actual. |
| Configuración histórica | `config_version` en `tasks` no conserva por sí sola recursos/parámetros antiguos; cada ejecución debe mantener referencia recuperable a su versión. |
| Identidad e idempotencia de evidencia | PK autoincremental de evento no deduplica un reenvío externo; definir clave/origen, orden y conflicto de contenido. |
| Tiempo y fechas | Fecha de cliente no basta para TR: conservar presentación/respuesta válidas y unidad local, sin medir latencia a partir de hora de llegada al servidor. |
| Incidencias/estado | No forzar toda incidencia a un estado terminal ni tratar `LímiteAlcanzado` de la UI como estado de una sesión ya existente. Separar recorrido e impacto técnico por indicador. |

## Transiciones a especificar (conceptuales, no enum final)

- Iniciar: asignación/participante/consentimiento/disponibilidad/cupo válidos; registrar intento de manera consistente ante concurrencia.
- Pausar/reanudar: solo cuando la tarea lo permita; retomar el mismo intento y último estado confirmado, no duplicar respuestas.
- Finalizar/interrumpir/abandonar: conservar evidencia y razón; distinguir cierre operativo de cálculo/suficiencia posterior.
- Reintentar envíos/cierre: no duplicar; acordar tratamiento de datos tardíos y sesión cerrada.

La regla de qué estados consumen intento, los tiempos de abandono y efectos de revocación/deshabilitación durante ejecución están pendientes. Ver [contrato externo](../../games-integration.md); no copiar el default `2` ni el buffer `50` como política.
