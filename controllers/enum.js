const fs = require('fs');

const filepath = 'c:\\Users\\sebas\\Downloads\\NUEVA BD_STAMPLAB\\controllers\\cotizacionController.js';
const outpath = 'c:\\Users\\sebas\\Downloads\\NUEVA BD_STAMPLAB\\controllers\\cotizacionController_enumerado.js';

let content = fs.readFileSync(filepath, 'utf8');
let lines = content.split(/\r?\n/);

function e(line_num, note) {
    const idx = line_num - 1;
    if (idx >= 0 && idx < lines.length) {
        lines[idx] = lines[idx] + ` // ${note}`;
    }
}

// 1. createCotizacionInteligente
e(19, 1); e(20, 2); e(28, 3); e(29, 4); e(31, 5); e(32, 6); e(35, 7); e(36, 8); e(37, 9); e(40, 10); e(46, 11); e(47, 12); e(49, 13); e(51, 14);

// 2. crearVentaDirecta
e(65, 1); e(73, 2); e(74, 3); e(84, 4); e(85, 5); e(90, 6); e(93, 7); e(95, 8); e(97, 9); e(102, 10); e(104, 11); e(114, 12); e(116, 13); e(132, 14); e(163, 18); e(173, 19); e(188, 21); e(190, 22); e(202, 24); e(206, 25); e(213, 26);

// 3. crearCotizacionConDiseños
e(225, 1); e(228, 2); e(235, 3); e(238, 4); e(247, 5); e(248, 6); e(259, 7); e(260, 8); e(268, 9); e(275, 10); e(285, 11); e(302, 12); e(308, 13);

// 4. convertirCotizacionAVenta
e(318, 1); e(322, 2); e(339, 3); e(340, 4); e(343, 5); e(344, 6); e(351, 7); e(352, 8); e(357, 9); e(383, 10); e(393, 11); e(394, 12); e(404, 14); e(406, 15); e(416, 16); e(422, 17); e(434, 18); e(448, 19);

// 5. createCotizacionCompleta
e(484, 1); e(487, 2); e(488, 4); e(490, 6); e(491, 7); e(493, 9); e(500, 10); e(515, 15); e(523, 16); e(524, 17);

// 6. getAllCotizaciones
e(533, 1); e(546, 2); e(547, 3); e(554, 4); e(565, 5); e(591, 6); e(624, 7); e(632, 8);

// 7. getCotizacionById
e(640, 1); e(641, 2); e(657, 3); e(659, 5); e(674, 6);

// 8. updateCotizacion
e(680, 1); e(684, 2); e(691, 3); e(694, 5); e(697, 6); e(698, 7); e(699, 8); e(703, 9); e(712, 10); e(718, 11);

// 9. cancelarCotizacion
e(762, 1); e(764, 2); e(775, 3); e(776, 5); e(779, 7); e(780, 8); e(781, 9); e(785, 10); e(792, 11); e(799, 12);

fs.writeFileSync(outpath, lines.join('\n'));
console.log('Archivo enumerado generado con éxito.');
