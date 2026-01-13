// retos-aventuras.js
// Estructura centralizada de retos para todas las aventuras y todos los idiomas
// Cada aventura contiene un objeto por idioma, que a su vez contiene el array de retos correspondiente

export const RETOS_AVENTURAS = {
    Aventura1: {
        es: [
            // Array de retos Aventura1 ESPAÑOL
            {
                reto: 1,
                id: "R-1",
                tipo: "opcion",
                pregunta: "1. ¿Cuántas Aventuras pueden hacerse con Valencia be Guides?",
                opciones: ["4", "5", "6", "7"],
                correctas: ["7"],
                multiple: false
            },
            {
                reto: 2,
                id: "R-2",
                tipo: "opcion",
                pregunta: "2. ¿Sabía decirme cómo se llaman estas Torres?",
                opciones: ["Torres de Quart", "Torres de Serranos", "Torre del Miguelete", "Torre de Santa catalina"],
                correctas: ["Torres de Serranos"],
                multiple: false
            },
            {
                reto: 3,
                id: "R-3",
                tipo: "opcion",
                pregunta: "3. ¿En la cumbre de las torres ondea la bandera de Valencia: sus colores se componen de rojo, amarillo y… ?",
                opciones: ["Violeta", "Verde", "Azul"],
                correctas: ["Azul"],
                multiple: false
            },
            {
                reto: 4,
                id: "R-4",
                tipo: "texto",
                pregunta: "4. ¿Sabría decirme el nombre de la calle?",
                correctas: ["Calle Muro de Santa Ana"]
            },
            {
                reto: 5,
                id: "R-5",
                tipo: "opcion",
                pregunta: "5. ¿Qué porta San Lorenzo en la mano?",
                opciones: ["Una Paloma", "Una cuchara", "Una parrilla"],
                correctas: ["Una parrilla"],
                multiple: false
            },
            {
                reto: 6,
                id: "R-6",
                tipo: "opcion",
                pregunta: "6. ¿Con qué mano sujeta Neptuno la cornucopia?",
                opciones: ["Izquierda", "Derecha"],
                correctas: ["Derecha"],
                multiple: false
            },
            {
                reto: 7,
                id: "R-7",
                tipo: "texto",
                pregunta: "7. ¿Cuántas figuras rodean la fuente?",
                correctas: ["8"]
            },
            {
                reto: 8,
                id: "PZ-8",
                tipo: "puzzle",
                pregunta: "8. Plaza de la Virgen",
                src: "P8_puzzle_plaza_virgen.html"
            },
            {
                reto: 9,
                id: "R-9",
                tipo: "opcion",
                pregunta: "9. ¿Qué figura esculpida puede verse en el marco del cuadro?",
                opciones: ["Un Dragón", "Un Murciélago", "Una Corona"],
                correctas: ["Una Corona"],
                multiple: false
            },
            {
                reto: 10,
                id: "R-10",
                tipo: "opcion-multiple",
                pregunta: "10. ¿Qué puede verse dentro?",
                opciones: ["Un Altar", "Una bandera", "Una espada"],
                correctas: ["Un Altar", "Una bandera"],
                multiple: true
            },
            {
                reto: 11,
                id: "R-11",
                tipo: "texto",
                pregunta: "11. Sobre ésta hay una placa conmemorativa. ¿En qué año fue expuesta dicha placa?",
                correctas: ["1952"]
            },
            {
                reto: 12,
                id: "R-12",
                tipo: "texto",
                pregunta: "12. ¿En qué año se edificó esta finca? ¡Pista! Mire en la parte superior de la fachada.",
                correctas: ["1906"]
            },
            {
                reto: 13,
                id: "R-13",
                tipo: "opcion",
                pregunta: "13. ¿Qué puede verse dentro?",
                opciones: ["Una Plaza de Toros", "Unos baños romanos", "Una estación de metro"],
                correctas: ["Unos baños romanos"],
                multiple: false
            },
            {
                reto: 14,
                id: "R-14",
                tipo: "opcion",
                pregunta: "14. ¿Sabría determinar qué geometría tiene?",
                opciones: ["hexagonal", "Octogonal", "Cuadrangular"],
                correctas: ["hexagonal"],
                multiple: false
            },
            {
                reto: 15,
                id: "R-15",
                tipo: "texto",
                pregunta: "15. ¿Cuántos Arcos componen la puerta?",
                correctas: ["6"]
            },
            {
                reto: 16,
                id: "R-16",
                tipo: "opcion",
                pregunta: "16. ¿Recuerda qué animal corona el escudo municipal?",
                opciones: ["Un Dragón", "Un Murciélago", "Un Caballo"],
                correctas: ["Un Murciélago"],
                multiple: false
            },
            {
                reto: 17,
                id: "R-17",
                tipo: "opcion",
                pregunta: "17. ¡Preste atención a la fachada de la primera torre! ¿Qué Fruta Cítrica natural de Valencia decora la fachada?",
                opciones: ["Limones", "Pomelos", "Naranjas"],
                correctas: ["Naranjas"],
                multiple: false
            },
            {
                reto: 18,
                id: "PZ-18",
                tipo: "puzzle",
                pregunta: "18. Plaza de Toros y Estación del Norte",
                src: "P18_puzzle_plaza_de_Toros_y_estacion_norte.html"
            },
            {
                reto: 19,
                id: "R-19",
                tipo: "texto",
                pregunta: "19. ¿Sabría decirme qué comercio alberga dicho edificio?",
                correctas: ["?"]
            },
            {
                reto: 20,
                id: "R-20",
                tipo: "opcion-multiple",
                pregunta: "20. Sobre la entrada principal, en un arco de medio punto, figuras alegóricas representan a los cinco continentes. ¿Qué porta la figura central en sus manos?",
                opciones: ["Una Corona", "Una Espada", "Una Antorcha"],
                correctas: ["Una Antorcha", "Una Espada"],
                multiple: true
            },
            {
                reto: 21,
                id: "R-21",
                tipo: "opcion",
                pregunta: "21. ¿Qué porta la figura en la mano?",
                opciones: ["Una balanza", "Un libro", "Una pluma"],
                correctas: ["Una balanza"],
                multiple: false
            },
            {
                reto: 22,
                id: "R-22",
                tipo: "texto",
                pregunta: "22. ¿Cuantas plantas tiene el edificio?",
                correctas: ["10"]
            },
            {
                reto: 23,
                id: "R-23",
                tipo: "opcion",
                pregunta: "23. Busque la vidriera con los colores de la Señera valenciana en la fachada del edificio. ¿Sabría determinar qué forma tiene?",
                opciones: ["Cuadrangular", "Redonda", "Triangular"],
                correctas: ["Redonda"],
                multiple: false
            },
            {
                reto: 24,
                id: "R-24",
                tipo: "opcion-multiple",
                pregunta: "24. ¿Qué sostiene la virgen en sus manos?",
                opciones: ["Un Rosario", "Un niño", "Una corona"],
                correctas: ["Un Rosario", "Un niño"],
                multiple: true
            },
            {
                reto: 25,
                id: "R-25",
                tipo: "opcion",
                pregunta: "25. ¿Qué le entrega el ángel al niño?",
                opciones: ["Una paloma", "Un orbe", "Alimentos"],
                correctas: ["Un orbe"],
                multiple: false
            },
            {
                reto: 26,
                id: "PZ-26",
                tipo: "puzzle",
                pregunta: "26. Lonja de la Seda",
                src: "P26_puzzle_lonja.html"
            },
            {
                reto: 27,
                id: "R-27",
                tipo: "opcion-multiple",
                pregunta: "27. El barquero que rema a contracorriente.",
                opciones: ["Un hombre con rostro triste manejando un pequeño bote de madera escapa a contracorriente de un monstruo."],
                correctas: ["Un hombre con rostro triste manejando un pequeño bote de madera escapa a contracorriente de un monstruo."],
                multiple: true
            },
            {
                reto: 28,
                id: "R-28",
                tipo: "opcion-multiple",
                pregunta: "28. Un árbol muerto: símbolo del Pecado, se ve entre las dos hojas de la puerta y cumple la función de parteluz.",
                opciones: ["Observe en la copa del árbol una figura con forma de cabeza humana."],
                correctas: ["Observe en la copa del árbol una figura con forma de cabeza humana."],
                multiple: true
            }
        ],
        en: [], // Inglés
        fr: [], // Francés
        it: [], // Italiano
        nl: [], // Neerlandés
        ja: []  // Japonés
    },
    // Estructura para futuras aventuras:
    Aventura2: { es: [], en: [], fr: [], it: [], nl: [], ja: [] },
    Aventura3: { es: [], en: [], fr: [], it: [], nl: [], ja: [] },
    Aventura4: { es: [], en: [], fr: [], it: [], nl: [], ja: [] },
    Aventura5: { es: [], en: [], fr: [], it: [], nl: [], ja: [] },
    AventuraFallas: { es: [], en: [], fr: [], it: [], nl: [], ja: [] },
    Aventura34km: { es: [], en: [], fr: [], it: [], nl: [], ja: [] }
};

// Para uso en entornos CommonJS (Node.js) y navegador
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RETOS_AVENTURAS };
} else {
    window.RETOS_AVENTURAS = RETOS_AVENTURAS;
}
