# RF-010 (V3, propuesta): recursos y parámetros

## Aplicación a este backend

**Diseño no implementado.** Tareas registra/gestiona definiciones del banco fijo y versiones de configuración/recursos permitidos; el servicio externo las usa al ejecutar. No crear un editor de mecánicas, motor de juegos ni una UI administrativa en este repositorio. «Registrar juego» debe acordar su ID/mapeo externo, no abrir creación ilimitada de tipos de tarea.

**Decidir TA-03/IN-01:** quién publica recursos, parámetros autorizados/esquema, almacenamiento y versión histórica recuperable; definir consumidor y permiso de registro/edición. El límite ≤5 MB de D es objetivo documental por confirmar en la feature, no límite de paquete de eventos ni de evidencia legal.

**Pruebas del API:** cambio autorizado aplica a ejecuciones nuevas; sesión iniciada conserva referencia a versión previa; dato/parámetro no permitido se rechaza; fallo de archivos no publica una configuración inconsistente. No sobrescribir recursos antiguos si rompe trazabilidad. Ver [integración](../../../games-integration.md).

## Flujo original y evidencia

**Actor:** administrador autorizado. Banco fijo TG-00…06; cargar/reemplazar/retirar audio e imágenes y modificar solo parámetros permitidos, sin crear/borrar mecánicas. [V3 RF-010](../../../../original/requisitos_V3.xlsx), [A CU-TD-01 pp. 36–37](../../../../original/3%20ANALISIS%20DEL%20PROYECTO.docx.pdf). **Flujo:** consultar tarea fija → seleccionar recurso/parámetro permitido → validar tipo y límites (meta ≤5 MB por tarea en D §4 p. 12) → guardar versión → aplicar a ejecuciones nuevas, conservar versión de sesiones iniciadas. Error de recurso/permiso/versión → no alterar ejecución previa. **Aceptar/probar:** nueva ejecución usa versión nueva; sesión en curso mantiene antigua; cambio fuera de parámetros permitido se rechaza; TG-00 no se trata como puntuación cognitiva. Archivo en R2 propuesto, clave en BD; no hay esquema de parámetro ni formato/respuesta de API. [Modelo](../domain-model.md), [D §6.2 p. 14](../../../../original/DESCRIPCI%C3%93N%20DE%20DISE%C3%91O%20DE%20SOFTWARE.docx.pdf). Pendiente: lista de parámetros, estado evaluativo de TG-06 y versionado histórico.
