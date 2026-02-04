// puzzles-data.js
// Estructura centralizada de datos de puzzles para todas las aventuras
// Cada aventura contiene un objeto con los puzzles correspondientes
// Modelo similar a retos-aventuras.js para mantener consistencia

export const DATOS_PUZZLES = {
    Aventura1: {
        "PZ-8": {
            id: "PZ-8",
            nombre: "Puzzle Plaza de la Virgen",
            imagen: "fotos_Av1/04_plaza_de_la_virgen.jpg",
            tiempo: 180,
            filas: 3,
            columnas: 3
        },
        "PZ-18": {
            id: "PZ-18",
            nombre: "Plaza de Toros y Estación del Norte",
            imagen: "fotos_Av1/15_plaza_de_toros_y_estacion_del_norte.jpg",
            tiempo: 180,
            filas: 3,
            columnas: 3
        },
        "PZ-26": {
            id: "PZ-26",
            nombre: "Lonja de la Seda",
            imagen: "fotos_Av1/23_lonja.jpg",
            tiempo: 180,
            filas: 3,
            columnas: 3
        }
    },
    // Estructura para futuras aventuras:
    Aventura2: {},
    Aventura3: {},
    Aventura4: {},
    Aventura5: {},
    AventuraFallas: {},
    Aventura34km: {}
};

// Para uso en entornos CommonJS (Node.js) y navegador
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DATOS_PUZZLES };
} else {
    window.DATOS_PUZZLES = DATOS_PUZZLES;
}
