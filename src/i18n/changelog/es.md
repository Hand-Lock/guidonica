<!-- Notas de la versión en español. -->
<!-- Released versions of CHANGELOG.md, translated at release time (ADR 0078). Keep the English
     headings and the same sections and bullet count; omit Internal. -->

## [2026.10.0] - 2026-10-05

### Added

- Practica 9/8 y 12/8: compases compuestos ternarios y cuaternarios, con la misma elección de pulso que en 6/8 (ADR 0076).
- Elige qué notas leer: cada nota se puede activar o desactivar en Ajustes, y el nivel Principiante empieza con solo unas pocas notas (ADR 0070).
- La bienvenida ahora también pregunta el compás, después del nivel y la clave (ADR 0071).
- Guidonica funciona sin conexión: tras una visita, se abre y suena sin internet (ADR 0063).
- Novedades: después de una actualización, Guidonica muestra qué ha cambiado desde tu última visita. «Acerca de» muestra la versión y la lista completa (ADR 0078).
- Un enlace a Ko-fi en «Acerca de» y en el pie de página, para propinas voluntarias (ADR 0074).
- «Acerca de» explica cómo se hace Guidonica, incluido el asistente de programación con IA usado para escribirla (ADR 0075).

### Changed

- Las luces de pulso y el clic tienen ahora tres niveles de acento: el primer tiempo, el pulso central del compás (el 3.er tiempo en 4/4, el 4.º en 6/8) y los demás tiempos (ADR 0072).
- Los niveles avanzan de forma más gradual en tempo, intervalos y figuras (ADR 0070).
- El botón de nivel muestra una mancuerna, para que ya no parezca un indicador de cobertura (ADR 0073).
- Los ritmos salen de un nuevo generador: cualquier figura que quepa en un compás ahora puede aparecer, y los silencios se escriben como lo haría un copista (ADRs 0064, 0065).
- Los silencios pueden ocupar tiempos y compases enteros, y los grupos pueden mezclar figuras, como una negra y una corchea bajo un corchete de tresillo (ADRs 0065, 0066).
- Las melodías hechas solo de saltos, como terceras o quintas, ahora alcanzan todas las notas del registro (ADR 0066).

## [1.0.0] - 2026-10-03

### Added

- Primera versión pública.
