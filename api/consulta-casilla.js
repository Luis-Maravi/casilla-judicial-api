export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }
  
  try {
    const { corte, casilla, dni, cv } = req.body;
    
    // Validar datos
    if (!corte || !casilla || !dni || !cv) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos' });
    }
    
    console.log('Consultando casilla:', casilla);
    
    // Paso 1: Obtener token CSRF
    const getResponse = await fetch('https://alertacasilla.pj.gob.pe/alertacasilla/', {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-PE,es;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    if (!getResponse.ok) {
      throw new Error(`Error al obtener página: ${getResponse.status}`);
    }
    
    const html = await getResponse.text();
    
    // Extraer token CSRF
    const tokenMatch = html.match(/name="anticsrf" value="([^"]+)"/);
    const anticsrfToken = tokenMatch ? tokenMatch[1] : '';
    
    if (!anticsrfToken) {
      throw new Error('No se pudo obtener token CSRF');
    }
    
    // Paso 2: Enviar consulta POST
    const formData = new URLSearchParams({
      'anticsrf': anticsrfToken,
      'corte': corte,
      'casilla': casilla,
      'dni': dni,
      'cv': cv
    });
    
    const postResponse = await fetch('https://alertacasilla.pj.gob.pe/alertacasilla/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-PE,es;q=0.9,en;q=0.8',
        'Referer': 'https://alertacasilla.pj.gob.pe/alertacasilla/',
        'Origin': 'https://alertacasilla.pj.gob.pe'
      },
      body: formData
    });
    
    if (!postResponse.ok) {
      throw new Error(`Error en consulta: ${postResponse.status}`);
    }
    
    const resultHtml = await postResponse.text();
    
    // Analizar resultado
    const noNotificaciones = resultHtml.includes('No se encontraron notificaciones para la casilla');
    const hayModal = resultHtml.includes('modalBusqueda');
    const hayDocumentos = resultHtml.includes('cdocumento');
    
    const resultado = {
      success: true,
      hayNotificaciones: hayModal && hayDocumentos && !noNotificaciones,
      mensaje: noNotificaciones ? 'Sin notificaciones' : (hayModal ? 'Hay notificaciones' : 'Revisar manualmente'),
      timestamp: new Date().toISOString(),
      casilla: casilla,
      detalles: {
        noNotificaciones,
        hayModal,
        hayDocumentos
      }
    };
    
    console.log('Resultado:', resultado);
    
    res.status(200).json(resultado);
    
  } catch (error) {
    console.error('Error en proxy:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
