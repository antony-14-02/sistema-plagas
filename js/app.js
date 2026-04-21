const URL = "../model/";

let model, webcam, labelContainer, loopRunning = false, modelReady = false;

// Cargar modelo al abrir la página
async function loadModel() {
  try {
    if (!modelReady) {
      console.log('Iniciando carga del modelo...');
      model = await tmImage.load(URL + "model.json", URL + "metadata.json");
      modelReady = true;
      console.log('✅ Modelo cargado correctamente');
    }
  } catch (error) {
    console.error('Error al cargar modelo:', error);
    modelReady = false;
    showError('No se pudo cargar el modelo. Verifica que los archivos estén disponibles: model.json y metadata.json');
  }
}

// Iniciar cámara
async function init() {
  try {
    if (!modelReady) {
      await loadModel();
    }

    // Detener cámara anterior si existe
    if (webcam) {
      loopRunning = false;
      if (webcam.canvas && webcam.canvas.parentNode) {
        webcam.canvas.parentNode.removeChild(webcam.canvas);
      }
    }

    console.log('Solicitando acceso a cámara...');
    
    // Solicitar permisos de cámara PRIMERO
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment', // Cámara trasera (cámara principal)
        width: { ideal: 640 },
        height: { ideal: 480 }
      },
      audio: false
    });
    
    console.log('✅ Cámara accesible, stream obtenido');
    
    // Crear nueva instancia de cámara con configuración para mobile
    webcam = new tmImage.Webcam(300, 300, true);
    
    // Asignar stream a la cámara
    await webcam.setup({
      facingMode: 'environment'
    });
    
    await webcam.play();
    
    console.log('✅ Webcam inicializado y reproduciendo');

    const container = document.getElementById("webcam-container");
    if (!container) {
      console.error('❌ Contenedor webcam-container no encontrado');
      return;
    }
    
    container.innerHTML = '';
    
    // Asegurar que el canvas se agregue al DOM
    if (webcam.canvas) {
      webcam.canvas.style.maxWidth = '100%';
      webcam.canvas.style.borderRadius = '8px';
      container.appendChild(webcam.canvas);
      console.log('✅ Canvas agregado al DOM');
    } else {
      console.error('❌ webcam.canvas no existe');
      return;
    }
    
    labelContainer = document.getElementById("label-container");

    loopRunning = true;
    window.requestAnimationFrame(loop);
    
    console.log('✅ Loop iniciado');
  } catch (error) {
    console.error('Error al inicializar cámara:', error);
    let mensaje = 'Error al acceder a la cámara. ';
    
    if (error.name === 'NotAllowedError') {
      mensaje += 'Permiso denegado. Por favor, permite el acceso a la cámara en la configuración del navegador.';
    } else if (error.name === 'NotFoundError') {
      mensaje += 'No se encontró cámara en el dispositivo.';
    } else if (error.name === 'NotReadableError') {
      mensaje += 'La cámara está siendo usada por otra aplicación.';
    } else {
      mensaje += error.message;
    }
    
    showError(mensaje);
  }
}

let lastPredictionTime = 0;
const PREDICTION_INTERVAL = 1000; // Actualizar cada 1 segundo para mejor performance en mobile

async function loop() {
  if (!loopRunning) return;
  
  if (webcam) {
    try {
      webcam.update();
      
      // Solo predecir cada cierto tiempo para no sobrecargar el dispositivo
      const now = Date.now();
      if (now - lastPredictionTime > PREDICTION_INTERVAL) {
        // Realizar predicción sin esperar (no bloquea el loop)
        predict(webcam.canvas).catch(err => console.warn('Error en predicción:', err));
        lastPredictionTime = now;
      }
    } catch (err) {
      console.error('Error en loop:', err);
    }
  }
  window.requestAnimationFrame(loop);
}

async function predict(image) {
  if (!model || !modelReady) {
    console.warn('Modelo no listo');
    return;
  }
  
  try {
    const predictions = await model.predict(image);
    
    if (!predictions || predictions.length === 0) {
      return;
    }
    
    mostrarResultado(predictions);
  } catch (error) {
    console.error('Error en predicción:', error);
  }
}

// Procesar imagen subida
document.addEventListener('DOMContentLoaded', () => {
  const imageUploadInput = document.getElementById("imageUpload");
  
  if (imageUploadInput) {
    imageUploadInput.addEventListener("change", async (e) => {
      if (!e.target.files[0]) return;
      
      try {
        labelContainer = labelContainer || document.getElementById("label-container");
        
        // Detener cámara si está activa
        loopRunning = false;
        if (webcam && webcam.canvas) {
          webcam.canvas.remove();
        }
        const btnCamera = document.getElementById("btn-camera");
        if (btnCamera) btnCamera.textContent = "📷 Iniciar Cámara";
        
        // Mostrar estado
        labelContainer.innerHTML = '<p style="text-align: center; color: #666;">⏳ Procesando imagen...</p>';
        
        // Cargar modelo si no está listo
        if (!modelReady) {
          console.log('Cargando modelo...');
          await loadModel();
          
          if (!modelReady) {
            showError('No se pudo cargar el modelo');
            return;
          }
        }
        
        // Cargar imagen
        const file = e.target.files[0];
        const reader = new FileReader();
        
        reader.onload = async (event) => {
          try {
            const img = new Image();
            img.crossOrigin = "anonymous";
            
            img.onload = async () => {
              try {
                console.log('Imagen cargada, dimensiones:', img.width, 'x', img.height);
                
                // Mostrar preview con la imagen original
                const previewContainer = document.getElementById("preview-upload");
                previewContainer.innerHTML = '';
                const previewImg = document.createElement('img');
                previewImg.src = img.src;
                previewImg.style.maxWidth = '100%';
                previewImg.style.borderRadius = '6px';
                previewContainer.appendChild(previewImg);
                
                // Crear canvas para el modelo (300x300)
                const canvas = document.createElement('canvas');
                canvas.width = 300;
                canvas.height = 300;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                
                if (!ctx) {
                  showError('No se pudo crear contexto de canvas');
                  return;
                }
                
                // Dibujar imagen en canvas
                ctx.drawImage(img, 0, 0, 300, 300);
                
                console.log('Canvas creado y imagen dibujada');
                
                // Realizar predicción
                if (modelReady && model) {
                  console.log('Iniciando predicción...');
                  labelContainer.innerHTML = '<p style="text-align: center; color: #666;">🔄 Analizando imagen...</p>';
                  
                  const predictions = await model.predict(canvas);
                  console.log('Predicción completa:', predictions);
                  
                  if (predictions && predictions.length > 0) {
                    mostrarResultado(predictions);
                  } else {
                    showError('No se obtuvieron predicciones');
                  }
                } else {
                  showError('Modelo no disponible. Recarga la página.');
                }
              } catch (error) {
                console.error('Error en predicción:', error);
                showError('Error al analizar: ' + error.message);
              }
            };
            
            img.onerror = (err) => {
              console.error('Error cargando imagen:', err);
              showError('No se pudo cargar la imagen');
            };
            
            img.src = event.target.result;
          } catch (error) {
            console.error('Error en reader.onload:', error);
            showError('Error al procesar la imagen');
          }
        };
        
        reader.onerror = () => {
          console.error('Error leyendo archivo');
          showError('Error al leer el archivo');
        };
        
        reader.readAsDataURL(file);
        
      } catch (error) {
        console.error('Error general:', error);
        showError('Error: ' + error.message);
      }
    });
  }
});

function showError(message) {
  labelContainer = labelContainer || document.getElementById("label-container");
  if (labelContainer) {
    labelContainer.innerHTML = `
      <div style="background: #ffebee; border-left: 4px solid #d32f2f; padding: 15px; border-radius: 4px; text-align: center;">
        <p style="color: #d32f2f; font-weight: 600; margin: 0 0 8px 0;">❌ Error</p>
        <p style="color: #c62828; font-size: 13px; margin: 0;">${message}</p>
      </div>
    `;
  }
}

// Cargar modelo cuando se carga la página
window.addEventListener('load', () => {
  console.log('Página cargada, iniciando carga del modelo');
  loadModel();
});

function mostrarResultado(predictions) {
  labelContainer = labelContainer || document.getElementById("label-container");
  labelContainer.innerHTML = "";

  if (!predictions || predictions.length === 0) return;

  // Encontrar la mejor predicción
  const mejor = predictions.reduce((a, b) => (a.probability > b.probability ? a : b), predictions[0]);

  // Normalizar y obtener nombre común (maneja variantes del modelo)
  function getCommonName(raw) {
    if (!raw) return raw;
    const s = raw.toString().toLowerCase();
    if (s.includes('deroceras') || s.includes('babosa')) return 'Babosa de la papa';
    if (s.includes('phytophthora') || s.includes('lancha') || s.includes('tiz') || s.includes('tizón') || s.includes('tizon')) return 'Lancha';
    if (s.includes('sana') || s.includes('saludable') || s.includes('planta de papa sana') || s.includes('papa sana')) return 'Papa sana';
    return raw;
  }

  const nombreComun = getCommonName(mejor.className);

  // Guardar datos de la predicción actual para poder guardarla después
  window.currentPrediction = {
    className: nombreComun,
    nombreCientifico: mejor.className,
    probability: mejor.probability,
    timestamp: new Date().toISOString()
  };

  // Obtener información de la plaga
  const plagasInfo = {
    'Babosa de la papa': {
      icon: '🐌',
      severity: 'Alta',
      color: '#7b1fa2'
    },
    'Lancha': {
      icon: '🦠',
      severity: 'Crítica',
      color: '#c62828'
    },
    'Papa sana': {
      icon: '🟢',
      severity: 'Ninguna',
      color: '#388e3c'
    }
  };

  const info = plagasInfo[nombreComun] || { icon: '❓', severity: 'Desconocida', color: '#666' };

  // Crear contenedor de resultado
  let html = `
    <div style="text-align: center; padding: 15px; border-left: 4px solid ${info.color}; background: rgba(0,0,0,0.02);">
      <div style="font-size: 32px; margin-bottom: 10px;">${info.icon}</div>
      <h3 style="margin: 0 0 5px 0; color: ${info.color}; font-size: 18px;">${nombreComun}</h3>
      <p style="margin: 0 0 8px 0; color: #999; font-size: 11px; font-style: italic;">${mejor.className}</p>
      <p style="margin: 0 0 10px 0; color: #666; font-size: 12px;">Confianza: <strong>${(mejor.probability * 100).toFixed(1)}%</strong></p>
      <p style="margin: 0; background: ${info.color}20; color: ${info.color}; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">${info.severity}</p>
    </div>
  `;

  // Agregar características si existe
  const detalles = obtenerDetallesPlaga(nombreComun);
  if (detalles) {
    html += `
      <div style="margin-top: 15px;">
        <p style="font-size: 12px; color: #666; margin: 0 0 8px 0;"><strong>📋 Descripción:</strong></p>
        <p style="font-size: 12px; color: #555; margin: 0 0 12px 0; line-height: 1.6;">${detalles.descripcion}</p>
        
        <p style="font-size: 12px; color: #666; margin: 0 0 8px 0;"><strong>👁️ Características Visibles:</strong></p>
        <ul style="margin: 0; padding-left: 18px; font-size: 11px; color: #555; line-height: 1.8;">
          ${detalles.caracteristicas.map(c => `<li>${c}</li>`).join('')}
        </ul>
        
        <p style="font-size: 12px; color: #666; margin: 12px 0 8px 0;"><strong>⚠️ Impacto en el Cultivo:</strong></p>
        <p style="font-size: 11px; color: #d32f2f; margin: 0 0 12px 0; background: #ffebee; padding: 10px; border-radius: 4px; border-left: 3px solid #d32f2f; line-height: 1.6;">${detalles.daños}</p>
        
        <p style="font-size: 12px; color: #666; margin: 0 0 8px 0;"><strong>🛡️ Control Recomendado:</strong></p>
        <p style="font-size: 11px; color: #1b5e20; margin: 0 0 15px 0; background: #e8f5e9; padding: 10px; border-radius: 4px; border-left: 3px solid #43a047; line-height: 1.6;">${detalles.control}</p>
        
        <button onclick="abrirModalGuardado()" style="width: 100%; padding: 12px; background: #43a047; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 14px; transition: background 0.3s;">
          💾 Guardar Detección en Mis Cultivos
        </button>
      </div>
    `;
  }

  labelContainer.innerHTML = html;
}

// Función para obtener detecciones de un cultivo
function obtenerDetecciones(cultivoId) {
  try {
    const key = `detecciones_${cultivoId}`;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.warn('Error al leer detecciones', e);
    return [];
  }
}

function obtenerDetallesPlaga(plaga) {
  const plagas = {
    'Babosa de la papa': {
      descripcion: 'Molusco terrestre (Deroceras reticulatum) que causa daños significativos en hojas y tubérculos.',
      caracteristicas: [
        '🔸 Color gris o marrón claro con capa viscosa',
        '🔸 Agujeros irregulares en hojas y tubérculos',
        '🔸 Manchas necróticas en tejido vegetal',
        '🔸 Más activa durante la noche (nocturna)',
        '🔸 Presencia de rastros viscosos (baba)',
        '🔸 Prefiere ambientes húmedos'
      ],
      daños: 'Reduce capacidad fotosintética, afecta calidad de tubérculos, puede transmitir Fusarium y Phytophthora. Pérdidas significativas sin control.',
      control: 'Cebos específicos para babosas, barreras de cobre alrededor de plantas, control biológico con depredadores naturales, manejo de humedad del suelo'
    },
    'Lancha': {
      descripcion: 'Phytophthora infestans (Lancha) es una enfermedad causada por un organismo similar a un hongo que afecta gravemente al cultivo de papa. Es una de las enfermedades más destructivas y puede arrasar un cultivo en pocos días si no se controla.',
      caracteristicas: [
        '🔸 Manchas irregulares de color verde oscuro a marrón en las hojas',
        '🔸 Bordes de las hojas con aspecto quemado',
        '🔸 Presencia de moho blanco o gris en el envés de la hoja (en ambientes húmedos)',
        '🔸 Tallos ennegrecidos y débiles',
        '🔸 Tubérculos con manchas marrones internas y pudrición'
      ],
      daños: 'Reducción drástica del rendimiento; pérdida total del cultivo si no se controla; deterioro de la calidad comercial del tubérculo; alta capacidad de propagación entre plantas.',
      control: 'Uso de fungicidas preventivos y curativos; eliminación de plantas infectadas; rotación de cultivos; uso de semilla certificada; buen manejo del riego y ventilación del cultivo',
      condiciones: [
        '🌧️ Alta humedad ambiental',
        '🌧️ Lluvias constantes',
        '🌡️ Temperaturas entre 10 °C y 20 °C',
        '💧 Suelos mal drenados'
      ]
    },
    'Papa sana': {
      descripcion: 'La planta de papa se encuentra en buen estado sanitario. Las hojas presentan un color verde uniforme, sin manchas, quemaduras ni perforaciones. Los tallos se observan firmes y sanos, sin signos de pudrición o ennegrecimiento. No se detecta presencia de plagas, enfermedades ni daños visibles. El cultivo puede continuar con su manejo normal.',
      caracteristicas: [
        '🍃 Hojas: color verde intenso y homogéneo, textura lisa, bordes completos sin mordeduras, superficie sin moho ni brillo excesivo',
        '🌿 Tallos: color verde natural, rectos y firmes, sin manchas negras ni colapsos, unión hoja–tallo limpia sin necrosis',
        '🧠 Indicadores técnicos: baja variación cromática (verde dominante), textura uniforme, ausencia de patrones circulares/irregulares/necróticos, sin zonas brillantes o húmedas anómalas, sin deformaciones estructurales'
      ],
      daños: 'Sin daños visibles; fotosíntesis activa y eficiente; bajo riesgo inmediato de plagas o enfermedades.',
      control: 'Monitoreo periódico. Mantener buenas prácticas de manejo de riego, ventilación y uso de semilla certificada.',
      interpretacion: 'Estado del cultivo: Saludable; Riesgo actual: Bajo; Acción recomendada: Monitoreo periódico.'
    }
  };
  
  return plagas[plaga] || null;
}
