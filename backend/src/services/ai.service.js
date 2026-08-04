const config = require('../config/env');

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent';

/**
 * Llama a la API de Gemini con el prompt dado.
 * @param {string} prompt
 * @returns {Promise<string>} texto de respuesta de Gemini
 */
async function callGemini(prompt) {
  const apiKey = config.googleAI.apiKey;
  if (!apiKey) {
    throw new Error('GOOGLE_AI_API_KEY no está configurada');
  }

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini no devolvió contenido');
  }
  return text;
}

/**
 * Clasifica una solicitud: prioridad, categoría, módulo sugerido y resumen.
 * @param {object} requestData - { processDescription, currentBehavior, expectedBehavior, moduleName }
 * @returns {Promise<object>} { prioridad, categoria, modulo_sugerido, resumen }
 */
async function classifyRequest(requestData) {
  const { processDescription, currentBehavior, expectedBehavior, moduleName } = requestData;

  const prompt = `Eres un analista de soporte de TI de una gobernación. Clasifica la siguiente solicitud de sistema.

Devuelve SOLO un objeto JSON válido, sin texto adicional, sin markdown, sin explicaciones:
{
  "prioridad": "alta" | "media" | "baja",
  "categoria": "error_bloqueante" | "mejora" | "consulta" | "incidente" | "configuracion" | "otro",
  "modulo_sugerido": "nombre del módulo más probable",
  "resumen": "resumen en una línea de máximo 100 caracteres"
}

Solicitud:
- Módulo afectado: ${moduleName || 'no especificado'}
- Proceso: ${processDescription}
- Comportamiento actual: ${currentBehavior}
- Comportamiento esperado: ${expectedBehavior}`;

  const raw = await callGemini(prompt);

  // Extraer el primer bloque JSON del texto devuelto
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Gemini no devolvió JSON válido: ' + raw);
  }

  return JSON.parse(jsonMatch[0]);
}

/**
 * Genera una respuesta formal en español neutro para una solicitud.
 * @param {object} data - { requestCode, applicantName, requestType, priority, tipoRespuesta, observaciones }
 * @returns {Promise<string>} texto de la respuesta formal
 */
async function generateResponse(data) {
  const {
    requestCode,
    applicantName,
    requestType,
    priority,
    tipoRespuesta,
    observaciones,
    processDescription,
  } = data;

  const prioridades = { alta: 'urgente', media: 'en curso', baja: 'baja prioridad' };

  let prompt = '';

  switch (tipoRespuesta) {
    case 'acuse':
      prompt = `Eres un asistente administrativo de una gobernación. Redacta un acuse de recibo formal en español neutro para una solicitud de sistema.

El acuse debe ser:
- Profesional y cálido
- En español neutro (sin regionalismos)
- Menos de 150 palabras
- Incluir: código de ticket, nombre del solicitante, tipo de solicitud, compromiso de respuesta según prioridad
- Tono oficial pero accesible

Datos:
- Código de ticket: ${requestCode}
- Solicitante: ${applicantName}
- Tipo de solicitud: ${requestType}
- Prioridad asignada: ${prioridades[priority] || 'media'}`;
      break;

    case 'avance':
      prompt = `Eres un asistente administrativo de una gobernación. Redacta una comunicación de avance sobre una solicitud de sistema en español neutro.

Requisitos:
- Profesional y cortés
- En español neutro
- Menos de 120 palabras
- Informar que la solicitud está siendo atendida
- Indicar que se contactarán si necesitan más información
- No prometas fechas específicas

Datos:
- Código de ticket: ${requestCode}
- Solicitante: ${applicantName}
- Tipo de solicitud: ${requestType}
- Prioridad: ${prioridades[priority] || 'media'}`;
      break;

    case 'info_adicional':
      prompt = `Eres un asistente administrativo de una gobernación. Redacta una solicitud de información adicional para una solicitud de sistema en español neutro.

Requisitos:
- Profesional y claro
- En español neutro
- Menos de 150 palabras
- Indicar qué información o documentación se necesita
- Explicar brevemente por qué es necesaria
- Invitar al solicitante a responder pronto

Datos:
- Código de ticket: ${requestCode}
- Solicitante: ${applicantName}
- Solicitud original: ${processDescription}
- Observaciones del equipo: ${observaciones || 'verificar detalles con el solicitante'}`;
      break;

    case 'resuelta':
      prompt = `Eres un asistente administrativo de una gobernación. Redacta una notificación de resolución para una solicitud de sistema en español neutro.

Requisitos:
- Profesional y satisfactorio
- En español neutro
- Menos de 120 palabras
- Confirmar que el issue/report ha sido resuelto
- Agradecer la colaboración
- Invitar a reportar si persiste el problema

Datos:
- Código de ticket: ${requestCode}
- Solicitante: ${applicantName}
- Tipo de solicitud: ${requestType}`;
      break;

    case 'rechazada':
      prompt = `Eres un asistente administrativo de una gobernación. Redacta una notificación de rechazo o no viabilidad para una solicitud de sistema en español neutro.

Requisitos:
- Profesional y empático
- En español neutro
- Menos de 150 palabras
- Explicar el motivo de forma clara y respetuosa
- Sugerir alternativas si es posible
- Mantener la puerta abierta para futuras solicitudes

Datos:
- Código de ticket: ${requestCode}
- Solicitante: ${applicantName}
- Tipo de solicitud: ${requestType}
- Motivo: ${observaciones || 'no Reunía los requisitos para ser procesada'}`;
      break;

    case 'observaciones':
      prompt = `Eres un asistente administrativo de una gobernación. Redacta una comunicación con observaciones técnicas para una solicitud de sistema en español neutro.

Requisitos:
- Profesional y detallado
- En español neutro
- Menos de 200 palabras
- Presentar los puntos de observación de forma clara y numerada
- Explicar cada punto brevemente
- Mantener un tono constructivo

Datos:
- Código de ticket: ${requestCode}
- Solicitante: ${applicantName}
- Solicitud: ${processDescription}
- Observaciones del equipo técnico: ${observaciones || 'revisar detalles técnicos con el área'}`;
      break;

    default:
      throw new Error(`Tipo de respuesta desconocido: ${tipoRespuesta}`);
  }

  const raw = await callGemini(prompt);
  return raw.trim();
}

module.exports = { classifyRequest, generateResponse };
