# PRESI – La Previa (prototipo web)

Juego de mesa digital para juntadas sobre fútbol argentino. Esta primera versión es el **modo Previa**:
rondas cortas (votaciones, trivia, retos, duelo de DT) que se juegan pasando un solo celular o compartiendo pantalla.

## Cómo probarlo
Abrí `presi/index.html` en el navegador (no necesita instalar nada), o servilo con `python3 -m http.server` desde esta carpeta.

## Modos
- **Edad:** si hay algún menor de 18 se usa el mazo apto para todos; si son todos mayores se suman cartas más picantes (alcohol solo como regla opcional).
- **Nivel:** cada jugador es ⚽ Fanático (trivia real) o 🛋️ Sillón (preguntas con pista + un Comodín del Tío).

## Agregar cartas
Todo el contenido está en `cards.js`. Cada carta tiene `edad: "todos" | "adulto"`; alcanza con sumar objetos a las listas.

## Pendiente
Modo Temporada (recursos, mercado, Mano Negra), perfiles de equipos y multijugador cada uno desde su celular.
