# RF-016 (V3, propuesta): catálogo y fichas de indicadores

## Aplicación a este backend

**Diseño no implementado.** Evolución ofrece fichas metodológicas; Tareas ofrece catálogo/configuración de actividades. Son catálogos distintos. Consultar una ficha no inicia un juego ni autoriza a editar fórmulas. El permiso de administración metodológica mencionado condicionalmente por A no está aprobado por existir rol ADMIN.

**Bloqueo EV-01:** cerrar definición por indicador con fórmula/entradas/unidad/exclusiones/suficiencia y versión; identificar qué es documentado, aprobado e implementado. Una métrica opcional de F no debe publicarse como obligatoria. TG-00/TG-06 pueden describirse como contexto pero no como puntuación cognitiva.

**Pruebas del API:** cada indicador publicado remite a ficha/versiones coherentes; definición no aprobada no se presenta como validada; consulta autorizada. El esquema/persistencia del catálogo y las rutas se especifican, no se deducen del ERD. Ver [modelo](../domain-model.md), [pendientes](../../../unresolved-issues.md).

## Flujo original y evidencia

**Actor:** docente autorizado consulta definición, propósito, fórmula, entradas, unidad, exclusiones, mínimo de datos y fundamento aprobado por tarea; práctica TG-00 no se equipara a medición. [V3 RF-016](../../../../original/requisitos_V3.xlsx), [A CU-GI-01 p. 38](../../../../original/3%20ANALISIS%20DEL%20PROYECTO.docx.pdf). **Flujo:** abrir catálogo → seleccionar tarea/indicador → mostrar ficha técnica y condiciones de indisponibilidad; si ficha no aprobada, no asumir fórmula ni publicar valor calculado como validado. **Criterios/pruebas:** cada indicador implementado puede localizarse por tarea, entradas, unidad y reglas de exclusión y coincide con metodología aprobada; TG-00 no figura como puntuación. Comparar ficha con [fórmulas documentadas](../domain-model.md) y casos sin datos. **Pendiente:** fichas aprobadas, umbrales y status TG-06 (F cierre no cognitivo vs V3 «evaluativa»). La administración de definiciones por administrador aparece solo como posibilidad en A §6.2, no permiso confirmado.
