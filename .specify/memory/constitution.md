# Constitución de Kudlab Backend

## Core Principles

### I. Finalidad pedagógica y no diagnóstico
Toda funcionalidad MUST servir al seguimiento pedagógico del piloto escolar y mantener
separadas las notas académicas, observaciones docentes y medidas de tareas digitales.
El sistema MUST NOT emitir diagnósticos clínicos o neuropsicológicos, rankings de
estudiantes, puntuaciones cognitivas únicas ni recomendaciones de PIAR automáticas.
Las interpretaciones MUST ser descriptivas y contextualizadas, sin atribuciones
causales ni baremos externos no validados. Esto evita presentar evidencia exploratoria
como una conclusión clínica o una evaluación curricular sustitutiva.

### II. Protección de menores y acceso controlado
Cada operación de lectura, modificación o asignación sobre datos de estudiantes MUST
verificar en el servidor la identidad, el rol, el estado de la cuenta y el ámbito
autorizado; ante una verificación fallida MUST denegar el acceso. La activación del
participante y el inicio de tareas MUST requerir evidencia de consentimiento vigente;
una revocación MUST impedir nuevas actividades. La recolección y exposición de datos
personales y evidencias MUST limitarse a lo necesario para el propósito autorizado,
con acceso restringido a archivos privados. La interfaz no reemplaza estos controles:
se trabaja con información sensible de menores.

### III. Evidencia íntegra e indicadores interpretables
Las sesiones de tarea MUST conservar la relación entre configuración, intentos,
eventos y resultados sin duplicar evidencia al recuperar o reenviar datos. Las
latencias de interacción MUST medirse en el cliente, conforme a ADR-01, y las
incidencias técnicas MUST distinguirse de las respuestas del estudiante. Los
indicadores MUST derivarse solo de eventos válidos y suficientes, con fórmula,
versión, unidad y condiciones de ejecución trazables; si falta evidencia, MUST
registrarse la ausencia y su motivo, nunca sustituirla por cero. TG-00 (práctica)
y TG-06 (cierre) MUST NOT aportar medidas cognitivas. Una comparación longitudinal
MUST declarar condiciones y versiones comparables o advertir su incompatibilidad.
Estas reglas impiden conclusiones engañosas a partir de sesiones incompletas o
heterogéneas.

### IV. Límites modulares y contratos explícitos
El backend MUST preservar la separación de responsabilidades documentada entre
Usuarios, Académico, Tareas, Evolución y Seguimiento: identidad/permisos,
participantes/consentimiento, ejecución/evidencia, cálculo/suficiencia y consulta
pedagógica, respectivamente. Las integraciones entre módulos y con el cliente MUST
definir entradas, salidas, errores y autorizaciones en sus especificaciones antes
de implementarse; los cambios de contrato MUST identificar a sus consumidores.
Las decisiones de tecnologías, persistencia y protocolo de ingesta aún en conflicto
MUST resolverse y registrarse antes de convertirlas en compromisos técnicos.
La separación SPA/API/almacenamiento acordada en ADR-02 permite evolucionar la
batería y el seguimiento sin confundir reglas de presentación con reglas de negocio.

### V. Trazabilidad y verificación de cambios
Cada requisito o regla incorporada MUST indicar fuente, versión y estado de
aprobación, especialmente al citar identificadores RF/RNF repetidos entre análisis,
diseño y V3; «documentado» MUST NOT tratarse como «aprobado» ni «implementado».
Si un resumen fundamenta una regla, contrato, cifra, fórmula, permiso o decisión de
persistencia, su pasaje en `docs/original/` MUST verificarse antes de incorporarlo
a una especificación o aceptar un cambio. Ante fuentes contradictorias o citas
imprecisas MUST localizarse cada pasaje; si la fuente falta, MUST dejarse constancia
y solicitar una decisión. Los resúmenes orientan la búsqueda, pero no sustituyen
la evidencia original.
Los cambios MUST incluir pruebas pertinentes para reglas de autorización,
consentimiento, integridad de sesiones y eventos, suficiencia y cálculo cuando esas
rutas resulten afectadas; los contratos entre módulos MUST verificarse al cambiar.
Los revisores MUST contrastar el comportamiento con la especificación aprobada y
registrar contradicciones pendientes en vez de inventar umbrales, escalas o
políticas. Así se mantiene comprobable la correspondencia entre evidencia,
decisiones y software.

## Restricciones del proyecto

- El alcance es un piloto escolar de tercero en el Colegio San Diego (Duitama),
  orientado a la docente y a sus estudiantes; el acudiente aporta o retira
  consentimiento externamente y no tiene rol de usuario por defecto.
- La arquitectura documentada contempla SPA, API REST, base relacional y
  almacenamiento de objetos privados. Node.js/TypeScript, Hono, Better Auth,
  Drizzle/PostgreSQL, R2 y Docker son propuestas del diseño, no decisiones
  obligatorias ni prueba de implementación. Una decisión aprobada MUST
  registrarse antes de fijar stack, autenticación del estudiante o ingesta de eventos.
- Las decisiones abiertas sobre revocación y conservación, fórmulas, umbrales,
  escalas, comparabilidad y anotaciones MUST resolverse por feature antes de
  prometer un comportamiento concreto; se consultan en
  `docs/agent-context/unresolved-issues.md` y en sus fuentes originales.
- Los objetivos de calidad documentados (API p95 <2 s, panel ≤3 s, recálculo
  ≤10 s, 30 usuarios concurrentes, disponibilidad escolar ≥95 %) son referencias
  de diseño: cada feature afectada MUST confirmar qué objetivos aplican y cómo
  medirlos antes de considerarlos criterios de aceptación aprobados.

## Flujo de desarrollo y revisión

1. Antes de especificar, MUST consultarse `docs/agent-context/INDEX.md`,
   `project-context.md`, `architecture-summary.md`, `decisions.md`,
   `unresolved-issues.md` y el resumen del módulo y la feature afectada. El
   índice permite localizar la fuente A (análisis), D (diseño), F (fundamento)
   o V3, así como diagramas y modelo de datos; sus IDs RF/RNF no son equivalentes.
2. Antes de fijar o aprobar una regla funcional, criterio de aceptación,
   contrato, dato sensible, fórmula, umbral, escala o decisión técnica derivada
   del contexto, MUST leerse el fragmento pertinente de la fuente original
   citada. Si los resúmenes discrepan o no indican página/hoja/sección, MUST
   buscarse el pasaje antes de decidir; si la fuente no está disponible, MUST
   registrarse esa carencia y solicitar una decisión. No se exige leer íntegros
   los documentos ajenos al tema de la feature.
3. Para localizar el fragmento, MUST seguirse el enlace del resumen hasta el
   archivo de `docs/original/`, abrir la página/sección citada en PDF, la hoja
   y fila/ID en XLSX, o el diagrama nombrado. Si la referencia es insuficiente,
   MUST buscarse dentro del archivo pertinente por término del dominio y por
   identificador **junto con su versión** (por ejemplo, «consentimiento» +
   «RF-008 de V3»), y leer el pasaje y su contexto cercano. Ante conflicto,
   MUST cotejarse el pasaje de cada fuente implicada, no elegir uno por el ID.
   Registrar en la especificación archivo, versión, página/sección o hoja/fila,
   afirmación contrastada, estado de aprobación y discrepancias. Si no se
   encuentra el pasaje, MUST declararse «sin respaldo localizado» y escalarse
   para decisión; MUST NOT inventarse una respuesta a partir del resumen.
4. Acordar requisitos observables y criterios de aceptación antes de diseñar
   contratos, modelo de datos y reglas de autorización. Escalar las decisiones
   abiertas al responsable del proyecto; no presentar propuestas V3 como RF
   aprobados ni firmas de diagramas como rutas existentes.
5. Revisar cada cambio contra los principios anteriores y ejecutar verificaciones
   proporcionales al riesgo: pruebas de permisos/ámbito, consentimiento, fallos
   y reintentos de sesión, y casos de evidencia insuficiente cuando apliquen.
   Documentar en la revisión el resultado y cualquier limitación pendiente.

## Governance

Esta constitución prevalece sobre convenciones y decisiones técnicas de menor
jerarquía para el backend Kudlab. Su modificación MUST proponerse con motivación,
impacto sobre especificaciones y contratos existentes, plan de adecuación si
corresponde, y aprobación explícita de la persona responsable del proyecto antes
de considerarse ratificada. Cada revisión de especificación o cambio relevante
MUST comprobar los principios aplicables y justificar por escrito cualquier
excepción temporal, con alcance y fecha de revisión.

La versión sigue MAJOR.MINOR.PATCH: MAJOR para eliminar o redefinir principios
de forma incompatible; MINOR para añadir principios, secciones o ampliar
obligaciones materialmente; PATCH para aclaraciones sin cambio normativo. Al
aprobar una enmienda MUST actualizarse la versión y `Last Amended`; `Ratified`
conserva la fecha de adopción original. El informe de impacto al comienzo es
material temporal de revisión y MUST retirarse antes de confirmar el documento.

**Version**: 1.1.0 | **Ratified**: 2026-10-12 | **Last Amended**: 2026-10-12
