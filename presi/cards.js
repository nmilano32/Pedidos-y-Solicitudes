// Mazos de cartas de PRESI. Cada carta lleva etiquetas:
//   edad: "todos" (apto menores) | "adulto" (solo mesas de mayores de 18)
// Para sumar contenido alcanza con agregar objetos a estas listas.
window.CARTAS = {
  // "¿Quién de la mesa...?" — modo "honor" premia al más votado, "castigo" le toca penitencia
  votos: [
    { modo: "honor", edad: "todos", texto: "¿Quién de la mesa sería el mejor presidente de club?" },
    { modo: "honor", edad: "todos", texto: "¿Quién se bancaría un descenso sin llorar?" },
    { modo: "honor", edad: "todos", texto: "¿Quién tiene más pinta de relator?" },
    { modo: "honor", edad: "todos", texto: "¿Quién conseguiría las mejores entradas para un clásico?" },
    { modo: "honor", edad: "todos", texto: "¿A quién pondrías de DT si se va el titular?" },
    { modo: "castigo", edad: "todos", texto: "¿Quién sería el primero en pelearse con el árbitro?" },
    { modo: "castigo", edad: "todos", texto: "¿Quién llora más si se erra un penal?" },
    { modo: "castigo", edad: "todos", texto: "¿Quién llegaría tarde a su propio debut en primera?" },
    { modo: "castigo", edad: "todos", texto: "¿Quién se haría el lesionado para no correr?" },
    { modo: "castigo", edad: "todos", texto: "¿Quién es el más caprichoso al elegir equipos en un picado?" },
    { modo: "honor", edad: "adulto", texto: "¿Quién negociaría mejor con un representante pícaro?" },
    { modo: "castigo", edad: "adulto", texto: "¿Quién vendería al club por una buena oferta y diría 'fue por el bien de la institución'?" },
    { modo: "castigo", edad: "adulto", texto: "¿Quién desaparecería con la caja del club?" },
    { modo: "castigo", edad: "adulto", texto: "¿Quién pasaría más tiempo en el palco que mirando el partido?" },
    { modo: "castigo", edad: "adulto", texto: "¿Quién sería el primero en pasarse de copas en el festejo de un campeonato?" }
  ],

  // Retos: los juzga la mesa (¿lo logró o no?)
  retos: [
    { titulo: "Cantito exprés", edad: "todos", seg: 15, texto: "Inventá un cantito para el jugador que tenés a la derecha." },
    { titulo: "Relator de la final", edad: "todos", seg: 20, texto: "Relatá un gol imaginario de un compañero como si fuera la final del Mundial." },
    { titulo: "Mímica de festejo", edad: "todos", seg: 20, texto: "Hacé la mímica de un festejo de gol. La mesa tiene que adivinar de qué jugador es." },
    { titulo: "Conferencia tras el 5-0", edad: "todos", seg: 20, texto: "Sos el DT y perdiste 5-0. Explicá por qué no fue tu culpa." },
    { titulo: "Ópera de tribuna", edad: "todos", seg: 15, texto: "Cantá una canción de cancha con voz de ópera." },
    { titulo: "Tiro libre de agua", edad: "todos", seg: 15, texto: "Narrá cómo tomás un vaso de agua como si fuera un tiro libre en el minuto 90." },
    { titulo: "Presentación de refuerzo", edad: "todos", seg: 20, texto: "Presentá a un compañero como el refuerzo estrella del año, con discurso incluido." },
    { titulo: "Foto de equipo", edad: "todos", seg: 10, texto: "Armá con toda la mesa la pose de foto formal de un equipo antes del partido." },
    { titulo: "Jueguito", edad: "todos", seg: 20, texto: "Hacé 5 toques seguidos con una bolita de papel sin que toque el piso." },
    { titulo: "Conferencia polémica", edad: "adulto", seg: 20, texto: "Te acusan de arreglar un partido. Zafá en una conferencia de prensa." },
    { titulo: "Discurso del presidente", edad: "adulto", seg: 20, texto: "Agradecé a los hinchas su apoyo… justo después de que el club se fundió." },
    { titulo: "Pelea en el túnel", edad: "adulto", seg: 20, texto: "Imitá a un dirigente discutiendo a los gritos con el árbitro en el túnel." }
  ],

  // Trivia para "Fanático": opciones y número de la correcta
  trivia: [
    { edad: "todos", p: "¿En qué año ganó Argentina su primer Mundial?", o: ["1978", "1986", "1974"], c: 0 },
    { edad: "todos", p: "¿Qué club argentino ganó más Copas Libertadores?", o: ["Boca", "Independiente", "River"], c: 1 },
    { edad: "todos", p: "¿Cómo se llama la cancha de Boca?", o: ["La Bombonera", "El Monumental", "Libertadores de América"], c: 0 },
    { edad: "todos", p: "¿Quién es el máximo goleador histórico de la Selección?", o: ["Batistuta", "Agüero", "Messi"], c: 2 },
    { edad: "todos", p: "¿Qué dos clubes juegan el Clásico de Avellaneda?", o: ["Independiente y Racing", "San Lorenzo y Huracán", "Newell's y Central"], c: 0 },
    { edad: "todos", p: "¿Quién dirigió a Argentina campeón en México 86?", o: ["Menotti", "Bilardo", "Basile"], c: 1 },
    { edad: "todos", p: "¿Qué club ganó la Libertadores 2018 final en Madrid?", o: ["River", "Boca", "Racing"], c: 0 },
    { edad: "todos", p: "¿A qué club le dicen \"El Ciclón\"?", o: ["Huracán", "San Lorenzo", "Banfield"], c: 1 },
    { edad: "todos", p: "¿Qué ciudad es la del clásico Newell's - Central?", o: ["Córdoba", "Mendoza", "Rosario"], c: 2 },
    { edad: "todos", p: "¿A quién le dicen \"El Kun\"?", o: ["Agüero", "Tevez", "Higuaín"], c: 0 },
    { edad: "todos", p: "¿A quién le dicen \"El Fideo\"?", o: ["Lavezzi", "Di María", "Otamendi"], c: 1 },
    { edad: "todos", p: "¿En qué club juvenil se formó Messi antes de irse a Barcelona?", o: ["Newell's", "Central", "Boca"], c: 0 },
    { edad: "todos", p: "¿Quién fue el DT de Argentina en Qatar 2022?", o: ["Sabella", "Scaloni", "Pekerman"], c: 1 },
    { edad: "todos", p: "¿A qué club de Italia llegó Maradona en 1984?", o: ["Napoli", "Juventus", "Milan"], c: 0 },
    { edad: "todos", p: "¿Contra quién jugó Argentina la final de Qatar 2022?", o: ["Croacia", "Francia", "Brasil"], c: 1 },
    { edad: "todos", p: "¿A quién le ganó Argentina la final de la Copa América 2021?", o: ["Uruguay", "Colombia", "Brasil"], c: 2 }
  ],

  // Trivia para "Hincha de Sillón": la pista casi regala la respuesta
  sillon: [
    { edad: "todos", p: "¿Quién puede agarrar la pelota con las manos? Pista: usa guantes y se para bajo los tres palos.", o: ["El arquero", "El delantero", "El lateral"], c: 0 },
    { edad: "todos", p: "¿Cuántos jugadores tiene cada equipo en la cancha? Pista: es el número de un \"equipo ideal\".", o: ["9", "11", "13"], c: 1 },
    { edad: "todos", p: "Si el árbitro saca la tarjeta roja… Pista: es como que te echan de una fiesta.", o: ["Te felicitan", "Te echan", "Cambiás de equipo"], c: 1 },
    { edad: "todos", p: "¿Qué se grita cuando la pelota entra al arco? Pista: tiene tres letras.", o: ["Hola", "Gol", "Uff"], c: 1 },
    { edad: "todos", p: "¿Cuánto dura un partido normal? Pista: son dos tiempos de 45 minutos.", o: ["60", "90", "120"], c: 1 },
    { edad: "todos", p: "¿De qué colores es la camiseta de la Selección? Pista: son los de la bandera.", o: ["Rojo y negro", "Celeste y blanco", "Verde y amarillo"], c: 1 },
    { edad: "todos", p: "¿Con qué se juega al fútbol? Pista: es redonda y se patea.", o: ["Una pelota", "Una raqueta", "Un bate"], c: 0 }
  ],

  // Penitencias para el que pierde un reto o termina último
  penitencias: [
    { edad: "todos", texto: "Cantá el himno de tu club a capela." },
    { edad: "todos", texto: "Hablá como relator hasta la próxima ronda." },
    { edad: "todos", texto: "Hacé 10 sentadillas gritando \"gol\" en cada una." },
    { edad: "todos", texto: "Elegí a alguien: te carga 15 segundos y no podés reírte." },
    { edad: "todos", texto: "Dejá que la mesa te ponga un apodo para el resto de la partida." },
    { edad: "todos", texto: "Hacé de arquero: la mesa te tira 3 bollitos de papel." },
    { edad: "todos", texto: "Contá el peor chiste de fútbol que sepas." },
    { edad: "todos", texto: "Ponete el buzo o la remera al revés hasta que termine la partida." },
    { edad: "adulto", texto: "Confesá tu mayor papelón futbolero." },
    { edad: "adulto", texto: "Mandale un audio a un amigo hincha rival: \"Tenías razón\"." },
    { edad: "adulto", texto: "Regla opcional: un trago, o un reto doble si preferís no tomar." }
  ]
};

// Duelo de DT: cada táctica le gana a una y pierde con otra
window.TACTICAS = [
  { id: "garra", nombre: "Garra", emoji: "🦵", gana: "toque", txt: "Garra le roba la pelota al Toque" },
  { id: "toque", nombre: "Toque", emoji: "🎯", gana: "pelotazo", txt: "Toque domina al Pelotazo" },
  { id: "pelotazo", nombre: "Pelotazo", emoji: "🚀", gana: "garra", txt: "Pelotazo se salta la Garra" }
];
