# Propósito, alcance y terminología

Prototipo piloto web de recopilación de observaciones docentes, notas de lectura/lenguaje y matemáticas y resultados de tareas digitales; integración y visualización longitudinal de estudiantes de tercero del Colegio San Diego (Duitama). Contexto de un grupo de 17 niños y una docente; meta de capacidad de 30 concurrentes. Apoyo pedagógico, no evaluación curricular sustitutiva, diagnóstico clínico/neuropsicológico ni definición de PIAR. [A pp. 4, 14, 17–19](../original/3%20ANALISIS%20DEL%20PROYECTO.docx.pdf); [F pp. 3, 12–14, 52](../original/Fundamento%20teorico.docx.pdf).

## Alcance confirmado del repositorio

**Aclaración del responsable en esta sesión:** los únicos usuarios humanos son profesores. Los roles actuales `TEACHER` y `ADMIN` expresan sus permisos; no crear un tercer actor de acceso por cada interesado institucional. Los estudiantes interactúan con otro servicio que provee los juegos. Este proyecto es una API para registrar/gestionar tareas, asignarlas y conservar/consultar los datos pedagógicos previstos; no contiene frontend docente ni motor de juegos.

En A y los diagramas, «sistema» suele significar la plataforma completa: administrador/coordinación gestiona cuentas y recursos según permiso; docente registra, asigna y consulta su ámbito; estudiante ejecuta en el servicio externo; acudiente aporta/retira consentimiento externamente; psicopedagogo es interesado consultivo, no rol de acceso. Esa descripción histórica no autoriza cuentas de estudiantes en este backend. [A pp. 5–8, 31–40](../original/3%20ANALISIS%20DEL%20PROYECTO.docx.pdf), [contexto original](../original/DIAGRAMAS-ANALISIS/DIAGRAMAS/01-Contexto/contextoGeneral/01-contexto-general.png).

La autenticación de la integración y el formato recibido del proveedor **no están acordados**. No reutilizar el login de profesores ni confiar en un `studentId` declarado por un cliente como solución implícita. Ver [integración](games-integration.md).

| Término | Significado |
| --- | --- |
| Kud | Mascota que guía instrucciones, práctica, transición y cierre; F pp. 3, 21–22. |
| TG-00…TG-06 | Práctica guiada, cinco tareas cognitivas TG-01…05 y cierre TG-06; F pp. 11, 17–19, 40. |
| Ensayo / evento | Oportunidad individual de respuesta / evidencia de interacción; F pp. 42–44. |
| Indicador / interpretación | Medida derivada / descripción contextual; no inferencia causal; F pp. 12–14, 42, 50–53. |
| Consentimiento vigente | Evidencia necesaria antes de activar participante o iniciar tarea; modalidades pendientes; V3 RF-008, D pp. 5–6. |
| Sesión de usuario / de tarea | Acceso autenticado / intento individual de actividad asignada; entidades diferentes; D pp. 8–10. |
| Batería / sesión de batería | Recorrido TG-00…06 en F §3; no equivale automáticamente a una fila `task_sessions` del ERD, que representa un intento de una tarea. La relación debe diseñarse. |
| Asignación docente / de tarea | Responsabilidad sobre estudiante/grupo (Académico) / decisión de aplicar una actividad (Tareas). Una no reemplaza a la otra. |
| Registro de tarea / ejecución | Definición de una actividad del banco fijo / realización individual de esa actividad. Registrar no significa permitir crear nuevas mecánicas. |
| Evento / resultado recibido / indicador validado | Evidencia de interacción / datos enviados por el productor / medida con regla, versión, suficiencia y procedencia verificadas. Recibir un valor no lo convierte en validado. |
| Tiempo de respuesta / fecha | Duración medida localmente entre estímulo y respuesta / marca cronológica para ordenar registros; no restar relojes de máquinas distintas. |

## Fuera de alcance y condiciones de trabajo

- No desarrollar aquí juegos, mascota, animaciones, almacenamiento del navegador ni pantallas/gráficos; documentar qué información debe ofrecer la API a esos consumidores.
- No integrar automáticamente sistemas académicos externos, definir PIAR ni importar baremos clínicos.
- El tamaño del piloto no permite eliminar autorización por ámbito ni suponer un único profesor en las reglas.
- Los modelos ERD y los RF V3 son fuentes de diseño: verificar [estado actual](architecture-summary.md) antes de crear tablas o reemplazar comportamiento existente.
- Fórmulas, escalas, retención y contratos abiertos se resuelven por feature; no paralizan los módulos no afectados. Ver [pendientes](unresolved-issues.md).

**Reglas globales:** autorización por rol y responsabilidad en servidor; minimización y consentimiento para menores; separar fallo técnico de error de estudiante, no convertir dato faltante en cero; trazar variable → indicador → contexto; sin rankings ni etiquetas clínicas. [V3 RF-004, 008, 018–022](../original/requisitos_V3.xlsx), [F pp. 41–44, 50, 56–60](../original/Fundamento%20teorico.docx.pdf). [Ambigüedades](unresolved-issues.md).
