const config = require('../config/env');

const CLICKUP_API_BASE = 'https://api.clickup.com/api/v2';

/**
 * Crea una tarea en ClickUp cuando se crea una solicitud
 */
async function createTaskFromRequest(request, ticketCode) {
  const { token, listId } = config.clickup;
  
  if (!token || !listId) {
    console.log('ClickUp no configurado, saltando creación de tarea');
    return null;
  }

  const priorityMap = {
    alta: 1,   // Urgent
    media: 3,  // Normal
    baja: 4,   // Low
  };

  const taskData = {
    name: `[${ticketCode}] ${request.process_description?.substring(0, 100) || 'Solicitud'}`,
    description: buildDescription(request, ticketCode),
    priority: priorityMap[request.priority] || 3,
    status: 'to do',
    assignees: [], // Se puede asignar después
    tags: [
      request.priority || 'media',
      request.module_name || 'sin-modulo',
    ].filter(Boolean),
    custom_fields: [],
  };

  try {
    const response = await fetch(`${CLICKUP_API_BASE}/list/${listId}/task`, {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(taskData),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Error creating ClickUp task:', error);
      return null;
    }

    const task = await response.json();
    console.log(`Tarea ClickUp creada: ${task.id} para solicitud ${ticketCode}`);
    return task;
  } catch (err) {
    console.error('Error connecting to ClickUp:', err.message);
    return null;
  }
}

/**
 * Construye la descripción de la tarea
 */
function buildDescription(request, ticketCode) {
  const lines = [
    `**Ticket:** ${ticketCode}`,
    `**Prioridad:** ${(request.priority || 'media').toUpperCase()}`,
    `**Módulo:** ${request.module_name || 'No especificado'}`,
    `**Tipo:** ${request.request_type_name || 'No especificado'}`,
    '',
    `**Proceso Administrativo:**`,
    request.process_description || 'No especificado',
    '',
    `**Comportamiento Actual:**`,
    request.current_behavior || 'No especificado',
    '',
    `**Comportamiento Esperado:**`,
    request.expected_behavior || 'No especificado',
    '',
    `---`,
    `*Creada automáticamente desde SOLICITUDES-DISI*`,
  ];
  
  return lines.join('\n');
}

/**
 * Actualiza el estado de una tarea en ClickUp
 */
async function updateTaskStatus(taskId, status) {
  const { token } = config.clickup;
  
  if (!token || !taskId) return null;

  const statusMap = {
    'PENDIENTE': 'to do',
    'EN_PROCESO': 'to do',
    'COMPLETADA': 'complete',
    'RECHAZADA': 'complete',
  };

  const clickupStatus = statusMap[status] || 'to do';

  try {
    const response = await fetch(`${CLICKUP_API_BASE}/task/${taskId}`, {
      method: 'PUT',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: clickupStatus }),
    });

    if (!response.ok) {
      console.error('Error updating ClickUp task status');
      return null;
    }

    return await response.json();
  } catch (err) {
    console.error('Error connecting to ClickUp:', err.message);
    return null;
  }
}

module.exports = { createTaskFromRequest, updateTaskStatus };
