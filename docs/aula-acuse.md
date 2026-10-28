# J-03 · Refinamiento de aula y acuse automático

## Autorización y límites

Tras probar J-03, el responsable aprobó abrir directamente estudiantes/códigos al guardar, relegar configuración y gestión, y permitir proyección colectiva en clase aceptando el riesgo descrito: un código acredita posesión, no identidad física, y puede ser usado por otro estudiante que lo vea. Sustituye la decisión inicial de distribución exclusivamente individual. No autoriza exposición de resultados, impresión, mensajería ni cuentas STUDENT. Uso real continúa bloqueado por participación institucional y G-01…G-04.

El responsable rechazó mantener «reconciliar acuse» como opción docente, incluso secundaria: debe resolverse automáticamente. No se elimina evidencia ni se renueva automáticamente permiso de entrega.

## Implementación

- Crear asignación y preparar códigos siguen siendo operaciones separadas e idempotentes. La UI conserva requestId de creación y requestId por lote; solo navega a estudiantes/códigos cuando confirma ambas. Si falla un lote, explica que la asignación ya existe y la misma solicitud permite reconciliar sin duplicar. No hay doble selección de destinatarios. Cada lote conserva el límite 100; no se cambia el máximo de asignación de 1000.
- Roster de 30 destinatarios por página, solo código de actividad ACTIVE y revelable. Revelados individuales autorizados con concurrencia máxima 5, en memoria. La proyección modal muestra tarea, URL pública, nombres y códigos, no gestión, resultados ni SUBMIT_ONLY. Caducidad/revocación siguen siendo verificadas por el servidor al canjear; la pantalla no prueba identidad.
- Pérdida de foco/visibilidad, navegación o retirada de acceso eliminan códigos de la UI y abortan respuestas tardías. Actualizar exige volver a mostrar. Sin código en URL ni storage; capturas sintéticas con códigos ocultos o enmascarados.
- `GET /api/v1/game-runtime/sessions/{id}/receipt?submissionId=…` ya existía. Ahora admite **solo para esta consulta** una capacidad expirada, con secreto original de alta entropía, canReadReceipt y sesión/submission correspondientes. Capacidad revocada o desconocida se deniega. No se exponen evidencias, nombres ni credenciales; solo el acuse ya existente o null. No cambia fechas, intentos ni permisos y no escribe evidencia.
- `POST results`, `POST start` y lectura de contexto conservan comprobación de caducidad. Ninguna capacidad se renueva automáticamente. Código corto vencido, reemplazado o revocado no sirve como autenticación para consultar acuses: se requiere el secreto de capacidad ya conservado en el navegador original.
- Ante 401 de entrega, Play consulta automáticamente ese GET. También revisa pendientes AUTH_REQUIRED de builds anteriores cuyo último error fue RUNTIME_UNAUTHENTICATED. Antes de limpiar valida sesión, submissionId y hash contra el paquete local; luego persiste el acuse y limpia transaccionalmente. Si falta acuse, hay conflicto o revocación, conserva todo. Red/503/429 conservan reintento con backoff/Retry-After; una consulta denegada o ausente detiene el bucle automático de autorización.
- Si **nunca llegaron** los resultados y venció la autorización, no es un acuse perdido. Se conserva «Resolver un envío pendiente» únicamente en sesiones sin recepción, con recuperación SUBMIT_ONLY ya aprobada. No se oculta un problema real afirmando que fue recibido.

## Compatibilidad

Sin migración, sobres nuevos ni fórmulas. Artefacto 1.2.0 y sobres 1.0/1.1 se conservan. OpenAPI describe la excepción de lectura; el campo backend `reconcileReceipt` permanece por compatibilidad, pero el cliente docente ya no lo envía ni ofrece un botón para ello.

Orden de publicación técnica: backend compatible primero, Play después y frontend docente coordinado. Un backend anterior aún deniega la consulta expirada; no tratar su rechazo como recepción ni borrar el pendiente. No desplegar una versión de Play que dependa de esa excepción contra un backend que no la implementa.

Bases de trabajo: backend d867879, frontend cc6ce32, Play c6ed861; worktrees nuevos `kudlab-{backend,frontend,play}-j03-aula`, sin tocar los servicios que el responsable usó en 5183/4313/4183 ni su BD. Verificación nueva aislada en 5184/4314/4184 y BDs `kudlab_j02_j03_aula_{unit,browser}_test`. Evidencia y resultados concretos se añaden al cierre; este diseño no acredita por sí solo pruebas superadas.
