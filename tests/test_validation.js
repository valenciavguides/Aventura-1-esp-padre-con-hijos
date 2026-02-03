console.log('Test starting...');

const testResponse = {
    exito: true,
    coordenadas: [{id: 'P-0', tipo: 'parada', nombre: 'Inicio', coordenadas: {lat: 39.47, lng: -0.37}}],
    total: 1,
    paradaId: 'P-0'
};

console.log('Test response:', testResponse);

// Test validation logic (similar to funciones-mapa.js)
if (!testResponse.exito) {
    console.log('Error: exito is false');
} else if (!testResponse.coordenadas || !Array.isArray(testResponse.coordenadas)) {
    console.log('Error: coordenadas is not array');
} else {
    console.log('Validation passed');
}

console.log('Test completed.');