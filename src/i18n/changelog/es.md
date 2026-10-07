<!-- Notas de la versión en español. -->
<!-- Released versions of CHANGELOG.md, translated at release time (ADR 0078). Keep the English
     headings and the same sections and bullet count; omit Internal. -->

## [2026.10.2] - 2026-10-07

### Added

- Compases de pulso de blanca para la música antigua. El interruptor Pulso de blanca, en Ajustes → Pentagrama y en la bienvenida, convierte 4/4, 3/4, 2/4, 6/8, 9/8 y 12/8 en 4/2, 3/2, 2/2 (alla breve), 6/4, 9/4 y 12/4, con clic en cada blanca, cuadradas y el silencio de cuadrada (ADR 0090).
- Un bordón sobre el que cantar: una caja shruti o un pad sostenidos en cualquier nota, con su propio volumen, en Ajustes → Práctica. Silenciar también lo calla, y suena ya en la cuenta previa para que oigas la tónica antes de la primera nota. Los enlaces a ejercicios incluyen la nota del bordón (ADR 0092).
- Signos de compasillo y de alla breve: Ajustes → Pentagrama puede escribir 4/4 como C y 2/2 como ¢ (ADR 0093).
- Afina el bordón con el La a 415, 430, 442 o 466 Hz además de 440, para la afinación barroca, clásica o renacentista, en Ajustes → Práctica. Los enlaces a ejercicios la incluyen (ADR 0094).
- Pulsa D para encender y apagar el bordón.

### Changed

- El ajuste Pulso ahora funciona también en los compases de pulso de blanca: el clic sigue el pulso o cada subdivisión (ADR 0090).

### Fixed

- La partitura se desplaza con fluidez en pantallas de alta frecuencia de actualización y en Firefox, donde podía dar tirones (ADR 0089).
- El desplazamiento ya no se atasca con cada clic del metrónomo ni al dibujar un compás nuevo, en pantallas de hasta 144 Hz (ADR 0091).
- Guidonica se abre con sus ajustes predeterminados en lugar de no arrancar cuando Firefox o Safari bloquean los datos de los sitios (ADR 0096).
- En una pantalla ancha, los Ajustes ahora se abren junto al pentagrama en la primera visita, por rápido que carguen las fuentes (ADR 0096).
- El desplazamiento es fluido en Firefox con la protección contra el fingerprinting activada, y en Tor y Mullvad Browser (ADR 0096).

## [2026.10.1] - 2026-10-06

### Added

- «Acerca de» y el pie de página enlazan a Guidonica en Bluesky y Mastodon (ADR 0082).
- «Acerca de» y el pie de página enlazan también a Guidonica en Instagram, donde puedes ver el tráiler (ADR 0084).
- Envía un ejercicio como enlace: Ajustes → Práctica → Enlace al ejercicio copia un enlace con tu clave, compás, tempo, figuras y notas, y quien lo abre practica con los mismos ajustes (ADR 0085).
- Guidonica tiene una dirección en cada idioma: guidonica.it/it/, /fr/, /de/ y /es/ se abren en italiano, francés, alemán y español, para que las búsquedas en esos idiomas la encuentren (ADR 0086).
- Al abrir Guidonica, un breve consejo señala funciones que quizá se te hayan pasado, como los niveles predefinidos, los nombres de las notas y los enlaces a ejercicios, y de vez en cuando nuestras redes sociales y Ko-fi. Desactiva los consejos en Ajustes → Práctica → Consejos. (ADR 0087)
- Una política de privacidad, en inglés e italiano, enlazada desde «Acerca de» y el pie de página (ADR 0088).

### Changed

- La línea de privacidad de «Acerca de» ahora dice que tus ajustes se quedan en tu dispositivo. Visitar el sitio sigue contactando con su alojamiento, GitHub Pages, como explica la política de privacidad (ADR 0088).

### Fixed

- En Instagram, Facebook y Threads, que no giran, el consejo de orientación horizontal ahora explica cómo abrir Guidonica en tu navegador (ADR 0083).
- Los botones Novedades y Acerca de ya no se salen del diálogo en móviles estrechos: las etiquetas largas pasan a la línea siguiente.

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
