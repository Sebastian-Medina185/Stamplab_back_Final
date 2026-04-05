const fs = require('fs');
const path = require('path');

const srcPath = "c:\\Users\\sebas\\Downloads\\NUEVA BD_STAMPLAB\\controllers\\cotizacionController.js";
const destPath = "C:\\Users\\sebas\\.gemini\\antigravity\\brain\\de8a2303-63ce-4198-a725-936b127e0b64\\caja_blanca_cotizacionController.md";

const fileContent = fs.readFileSync(srcPath, 'utf8');
const lines = fileContent.split(/\r?\n/);

function getCode(start, end) {
    let code = "```javascript\n";
    for(let i = start; i <= end; i++) {
        if(i <= lines.length) {
            code += `${i}: ${lines[i-1]}\n`;
        }
    }
    code += "```\n\n";
    return code;
}

let md = `# Pruebas de Caja Blanca - cotizacionController.js\n\n`;
md += `A continuación, se presenta todo el proceso solicitado, con códigos sin reducir numerados, análisis de complejidad ciclomática, caminos de prueba y representaciones gráficas fidedignas al estilo solicitado.\n\n`;

// 1
md += `## 1. getAllCotizaciones (GET)\n`;
md += `**Complejidad Ciclomática**: 14 Aristas - 11 Nodos + 2 = **5**\n`;
md += `### Casos de Prueba (Caminos)\n| Caso | Camino | Resultado Esperado |\n|---|---|---|\n| CP1 | 1 → 2 → 6 → 8 → 9 → 11 | Retorna 200 con todas las cotizaciones |\n| CP2 | 1 → 2 → 3 → 4 → 6 → 8 → 9 → 11 | Retorna 200 listando por ID exacto |\n| CP3 | 1 → 2 → 3 → 5 → 6 → 8 → 9 → 11 | Retorna 200 con filtro textual |\n| CP4 | 1 → 2 → 6 → 7 → 8 → 9 → 11 | Retorna 200 con estado filtrado |\n| CP5 | 1 → 10 → 11 | Retorna 500 (Catch Exception) |\n`;
md += `### Diagrama de Grafo\n\`\`\`mermaid\ngraph TD\n    classDef red fill:#ff9999,stroke:#333,stroke-width:1px,color:#000;\n    classDef green fill:#99ff99,stroke:#333,stroke-width:1px,color:#000;\n    classDef white fill:#ffffff,stroke:#333,stroke-width:1px,color:#000;\n\n    1((1. Inicio)):::red --> 2((2. if search)):::white\n    2 --> 3((3. if !isNaN)):::white\n    2 --> 6((6. if estado !== Todos)):::white\n    3 --> 4((4. search Numérico)):::white\n    3 --> 5((5. search Texto)):::white\n    4 --> 6\n    5 --> 6\n    6 --> 7((7. Filtro Estado)):::white\n    6 --> 8((8. Consultas DB)):::white\n    7 --> 8\n    8 --> 9((9. Retornar 200)):::green\n    1 -. Catch Exception .-> 10((10. Error 500)):::red\n    9 --> 11((11. Fin)):::red\n    10 --> 11\n\`\`\`\n`;
md += `### Código Enumerado\n` + getCode(532, 636);

// 2
md += `## 2. getCotizacionById (GET)\n`;
md += `**Complejidad Ciclomática**: 8 Aristas - 7 Nodos + 2 = **3**\n`;
md += `### Casos de Prueba (Caminos)\n| Caso | Camino | Resultado Esperado |\n|---|---|---|\n| CP1 | 1 → 2 → 3 → 7 | Retorna 404 Cotización no encontrada |\n| CP2 | 1 → 2 → 4 → 5 → 7 | Retorna 200 JSON enriquecido |\n| CP3 | 1 → 6 → 7 | Retorna 500 (Catch Exception) |\n`;
md += `### Diagrama de Grafo\n\`\`\`mermaid\ngraph TD\n    classDef red fill:#ff9999,stroke:#333,stroke-width:1px,color:#000;\n    classDef green fill:#99ff99,stroke:#333,stroke-width:1px,color:#000;\n    classDef white fill:#ffffff,stroke:#333,stroke-width:1px,color:#000;\n\n    1((1. Inicio)):::red --> 2((2. if !cotizacion)):::white\n    2 --> 3((3. Retornar 404)):::red\n    2 --> 4((4. Enriquecer JSON)):::white\n    4 --> 5((5. Retornar 200)):::green\n    1 -. Catch Exception .-> 6((6. Error 500)):::red\n    3 --> 7((7. Fin)):::red\n    5 --> 7\n    6 --> 7\n\`\`\`\n`;
md += `### Código Enumerado\n` + getCode(639, 677);

// 3
md += `## 3. createCotizacionCompleta (POST)\n`;
md += `**Complejidad Ciclomática**: 17 Aristas - 13 Nodos + 2 = **6**\n`;
md += `### Casos de Prueba (Caminos)\n| Caso | Camino | Resultado Esperado |\n|---|---|---|\n| CP1 | 1 → 2 → 3 → 12 | Retorna 400 (Falta DocumentoID) |\n| CP2 | 1 → 2 → 4 → 5 → 12 | Retorna 400 (Faltan detalles) |\n| CP3 | 1 → 2 → 4 → 6 → 7 → 12 | Retorna 404 (Usuario inexistente) |\n| CP4 | 1 → 2 → 4 → 6 → 8 → 9 → 10 → 12 | Retorna 201 (Cotización exitosa) |\n| CP5 | 1 → 11 → 12 | Retorna 500 (Catch Exception) |\n`;
md += `### Diagrama de Grafo\n\`\`\`mermaid\ngraph TD\n    classDef red fill:#ff9999,stroke:#333,stroke-width:1px,color:#000;\n    classDef green fill:#99ff99,stroke:#333,stroke-width:1px,color:#000;\n    classDef white fill:#ffffff,stroke:#333,stroke-width:1px,color:#000;\n\n    1((1. Inicio)):::red --> 2((2. if !DocID)):::white\n    2 --> 3((3. Retornar 400)):::red\n    2 --> 4((4. if !detalles)):::white\n    4 --> 5((5. Retornar 400)):::red\n    4 --> 6((6. if !usuario)):::white\n    6 --> 7((7. Retornar 404)):::red\n    6 --> 8((8. Crear Cabecera DB)):::white\n    8 --> 9((9. Loop Guardar Detalles)):::white\n    9 --> 10((10. Retornar 201)):::green\n    1 -. Catch Exception .-> 11((11. Error 500)):::red\n    3 --> 12((12. Fin)):::red\n    5 --> 12\n    7 --> 12\n    10 --> 12\n    11 --> 12\n\`\`\`\n`;
md += `### Código Enumerado\n` + getCode(483, 527);

// 4
md += `## 4. updateCotizacion (PUT)\n`;
md += `**Complejidad Ciclomática**: 12 Aristas - 9 Nodos + 2 = **5**\n`;
md += `### Casos de Prueba (Caminos)\n| Caso | Camino | Resultado Esperado |\n|---|---|---|\n| CP1 | 1 → 2 → 3 → 9 | Retorna 404 Cotización no encontrada |\n| CP2 | 1 → 2 → 4 → 5 → 6 → 7 → 9 | Retorna 200 y devuelve el stock al cancelar |\n| CP3 | 1 → 2 → 4 → 6 → 7 → 9 | Retorna 200 y actualiza estandar |\n| CP4 | 1 → 8 → 9 | Retorna 500 (Catch Exception) |\n`;
md += `### Diagrama de Grafo\n\`\`\`mermaid\ngraph TD\n    classDef red fill:#ff9999,stroke:#333,stroke-width:1px,color:#000;\n    classDef green fill:#99ff99,stroke:#333,stroke-width:1px,color:#000;\n    classDef white fill:#ffffff,stroke:#333,stroke-width:1px,color:#000;\n\n    1((1. Inicio)):::red --> 2((2. if !cotizacion)):::white\n    2 --> 3((3. Return 404)):::red\n    2 --> 4((4. if cancelar aprobada)):::white\n    4 --> 5((5. Devolver Stock DB)):::white\n    4 --> 6((6. Update Valores DB)):::white\n    5 --> 6\n    6 --> 7((7. Return 200)):::green\n    1 -. Catch Exception .-> 8((8. Error 500)):::red\n    3 --> 9((9. Fin)):::red\n    7 --> 9\n    8 --> 9\n\`\`\`\n`;
md += `### Código Enumerado\n` + getCode(679, 721);

// 5
md += `## 5. cancelarCotizacion (PUT)\n`;
md += `**Complejidad Ciclomática**: 14 Aristas - 11 Nodos + 2 = **5**\n`;
md += `### Casos de Prueba (Caminos)\n| Caso | Camino | Resultado Esperado |\n|---|---|---|\n| CP1 | 1 → 2 → 3 → 11 | Retorna 404 No Encontrada |\n| CP2 | 1 → 2 → 4 → 5 → 11 | Retorna 400 (No se puede cancelar tras convertir) |\n| CP3 | 1 → 2 → 4 → 6 → 7 → 8 → 9 → 11 | Cancela aprobada y devuelve el stock (200)|\n| CP4 | 1 → 2 → 4 → 6 → 8 → 9 → 11 | Cancela estandar sin afectar Stock (200)|\n| CP5 | 1 → 10 → 11 | Retorna 500 Catch Exception |\n`;
md += `### Diagrama de Grafo\n\`\`\`mermaid\ngraph TD\n    classDef red fill:#ff9999,stroke:#333,stroke-width:1px,color:#000;\n    classDef green fill:#99ff99,stroke:#333,stroke-width:1px,color:#000;\n    classDef white fill:#ffffff,stroke:#333,stroke-width:1px,color:#000;\n\n    1((1. Inicio)):::red --> 2((2. if !cotizacion)):::white\n    2 --> 3((3. Return 404)):::red\n    2 --> 4((4. if Estado === 5)):::white\n    4 --> 5((5. Return 400)):::red\n    4 --> 6((6. if Estado === 2)):::white\n    6 --> 7((7. Devolver Stock DB)):::white\n    6 --> 8((8. Asignar Estado 4)):::white\n    7 --> 8\n    8 --> 9((9. Return 200)):::green\n    1 -. Catch Exception .-> 10((10. Error 500)):::red\n    3 --> 11((11. Fin)):::red\n    5 --> 11\n    9 --> 11\n    10 --> 11\n\`\`\`\n`;
md += `### Código Enumerado\n` + getCode(761, 802);

// 6
md += `## 6. convertirCotizacionAVenta (POST)\n`;
md += `**Complejidad Ciclomática**: 14 Aristas - 11 Nodos + 2 = **5**\n`;
md += `### Casos de Prueba (Caminos)\n| Caso | Camino | Resultado Esperado |\n|---|---|---|\n| CP1 | 1 → 2 → 3 → 11 | Retorna 404 (no encontrada) |\n| CP2 | 1 → 2 → 4 → 5 → 11 | Retorna 400 (Solo convierte aprobadas) |\n| CP3 | 1 → 2 → 4 → 6 → 7 → 11 | Retorna 400 (Sin productos vinculados) |\n| CP4 | 1 → 2 → 4 → 6 → 8 → 9 → 11 | Retorna 201 Nueva venta (Procesar Compra) |\n| CP5 | 1 → 10 → 11 | Retorna 500 Catch Exception |\n`;
md += `### Diagrama de Grafo\n\`\`\`mermaid\ngraph TD\n    classDef red fill:#ff9999,stroke:#333,stroke-width:1px,color:#000;\n    classDef green fill:#99ff99,stroke:#333,stroke-width:1px,color:#000;\n    classDef white fill:#ffffff,stroke:#333,stroke-width:1px,color:#000;\n\n    1((1. Inicio)):::red --> 2((2. if !cotizacion)):::white\n    2 --> 3((3. Return 404)):::red\n    2 --> 4((4. if Estado !== 2)):::white\n    4 --> 5((5. Return 400)):::red\n    4 --> 6((6. if !detalles)):::white\n    6 --> 7((7. Return 400)):::red\n    6 --> 8((8. Procesar Compra)):::white\n    8 --> 9((9. Return 201)):::green\n    1 -. Catch Exception .-> 10((10. Error 500)):::red\n    3 --> 11((11. Fin)):::red\n    5 --> 11\n    7 --> 11\n    9 --> 11\n    10 --> 11\n\`\`\`\n`;
md += `### Código Enumerado\n` + getCode(317, 457);

// 7
md += `## 7. createCotizacionConDiseños (POST)\n`;
md += `**Complejidad Ciclomática**: 6 Aristas - 6 Nodos + 2 = **2**\n`;
md += `### Casos de Prueba (Caminos)\n| Caso | Camino | Resultado Esperado |\n|---|---|---|\n| CP1 | 1 → 2 → 3 → 4 → 6 | Retorna 201 Creación éxitosa con diseños |\n| CP2 | 1 → 5 → 6 | Lanza throw exception Catch |\n`;
md += `### Diagrama de Grafo\n\`\`\`mermaid\ngraph TD\n    classDef red fill:#ff9999,stroke:#333,stroke-width:1px,color:#000;\n    classDef green fill:#99ff99,stroke:#333,stroke-width:1px,color:#000;\n    classDef white fill:#ffffff,stroke:#333,stroke-width:1px,color:#000;\n\n    1((1. Inicio)):::red --> 2((2. Loop y Crear DB)):::white\n    2 --> 3((3. Consultar Creada)):::white\n    3 --> 4((4. Return 201)):::green\n    1 -. Catch Exception .-> 5((5. Error throw)):::red\n    4 --> 6((6. Fin)):::red\n    5 --> 6\n\`\`\`\n`;
md += `### Código Enumerado\n` + getCode(222, 312);

// 8
md += `## 8. crearVentaDirecta (POST)\n`;
md += `**Complejidad Ciclomática**: 12 Aristas - 9 Nodos + 2 = **5**\n`;
md += `### Casos de Prueba (Caminos)\n| Caso | Camino | Resultado Esperado |\n|---|---|---|\n| CP1 | 1 → 2 → 3 → 9 | Retorna 400 Color/Talla no definidos |\n| CP2 | 1 → 2 → 4 → 9 | Retorna 400 Variante no existente |\n| CP3 | 1 → 2 → 5 → 9 | Retorna 400 Stock agotado |\n| CP4 | 1 → 2 → 6 → 7 → 9 | Retorna 201 Venta completada sin falla |\n| CP5 | 1 → 8 → 9 | Retorna Exception | \n`;
md += `### Diagrama de Grafo\n\`\`\`mermaid\ngraph TD\n    classDef red fill:#ff9999,stroke:#333,stroke-width:1px,color:#000;\n    classDef green fill:#99ff99,stroke:#333,stroke-width:1px,color:#000;\n    classDef white fill:#ffffff,stroke:#333,stroke-width:1px,color:#000;\n\n    1((1. Inicio)):::red --> 2((2. Validar Stock)):::white\n    2 --> 3((3. Return 400 Color/Talla)):::red\n    2 --> 4((4. Return 400 Variante)):::red\n    2 --> 5((5. Return 400 Stock)):::red\n    2 --> 6((6. Precios y Guardado DB)):::white\n    6 --> 7((7. Return 201)):::green\n    1 -. Catch Exception .-> 8((8. Error Exception)):::red\n    3 --> 9((9. Fin)):::red\n    4 --> 9\n    5 --> 9\n    7 --> 9\n    8 --> 9\n\`\`\`\n`;
md += `### Código Enumerado\n` + getCode(64, 217);

// 9
md += `## 9. createCotizacionInteligente (POST)\n`;
md += `**Complejidad Ciclomática**: 16 Aristas - 12 Nodos + 2 = **6**\n`;
md += `### Casos de Prueba (Caminos)\n| Caso | Camino | Resultado Esperado |\n|---|---|---|\n| CP1 | 1 → 2 → 3 → 12 | Retorna 400 DocID faltante |\n| CP2 | 1 → 2 → 4 → 5 → 12 | Retorna 400 Detalles faltantes |\n| CP3 | 1 → 2 → 4 → 6 → 7 → 12 | Retorna 404 Usuario no valido |\n| CP4 | 1 → 2 → 4 → 6 → 8 → 9 → 12 | Entra a generar Venta Directa |\n| CP5 | 1 → 2 → 4 → 6 → 8 → 10 → 12 | Entra a generar Cotizacion Diseños |\n| CP6 | 1 → 11 → 12 | Retorna 500 Catch Exception | \n`;
md += `### Diagrama de Grafo\n\`\`\`mermaid\ngraph TD\n    classDef red fill:#ff9999,stroke:#333,stroke-width:1px,color:#000;\n    classDef green fill:#99ff99,stroke:#333,stroke-width:1px,color:#000;\n    classDef white fill:#ffffff,stroke:#333,stroke-width:1px,color:#000;\n\n    1((1. Inicio)):::red --> 2((2. if !DocID)):::white\n    2 --> 3((3. Return 400)):::red\n    2 --> 4((4. if !detalles)):::white\n    4 --> 5((5. Return 400)):::red\n    4 --> 6((6. if !usuario)):::white\n    6 --> 7((7. Return 404)):::red\n    6 --> 8((8. if !tieneDiseños)):::white\n    8 --> 9((9. Venta Directa)):::green\n    8 --> 10((10. Cotizacion Diseños)):::green\n    1 -. Catch Exception .-> 11((11. Error 500)):::red\n    3 --> 12((12. Fin)):::red\n    5 --> 12\n    7 --> 12\n    9 --> 12\n    10 --> 12\n    11 --> 12\n\`\`\`\n`;
md += `### Código Enumerado\n` + getCode(18, 59);

fs.writeFileSync(destPath, md, 'utf8');
console.log('Documento creado en: ' + destPath);
