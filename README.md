# Dorepy 🚀

Dorepy es un sistema web integral de telemetría y monitorización de hardware en tiempo real. Actúa bajo una arquitectura IoT (Edge-to-Cloud) donde los equipos cliente reportan su estado de consumo (CPU, RAM, GPU y procesos) a un servidor centralizado. Además, cuenta con un agente automatizado de Inteligencia Artificial que audita periódicamente las métricas para generar diagnósticos en lenguaje natural.

## ✨ Características Principales

- **Monitorización en Tiempo Real:** Visualización del consumo de recursos de múltiples equipos a través de un dashboard centralizado mediante WebSockets.
- **Auditoría Inteligente (IA):** Generación automática de reportes de rendimiento utilizando la API de Google Gemini (`gemini-3-flash-preview`). El sistema identifica anomalías y explica el comportamiento de los procesos de mayor consumo.
- **Diseño Responsive:** Interfaz adaptable a dispositivos móviles y de escritorio.
- **Seguridad:** Sistema de autenticación de usuarios mediante sesiones (Passport.js) y contraseñas encriptadas.

## 🛠️ Stack Tecnológico

**Backend:**
- [Node.js](https://nodejs.org/) y [Express](https://expressjs.com/)
- [MongoDB](https://www.mongodb.com/) (mediante Mongoose) para persistencia de datos.
- [Socket.io](https://socket.io/) para comunicación bidireccional en tiempo real.
- `node-cron` para la programación de tareas automatizadas (diagnósticos IA).
- Autenticación con `passport-local` y `bcryptjs`.
- Integración de IA con `@google/generative-ai`.

**Frontend:**
- HTML5, CSS3 y JavaScript puro (Vanilla JS).
- [Chart.js](https://www.chartjs.org/) para el renderizado de gráficas dinámicas.

## ⚙️ Instalación y Configuración local

Sigue estos pasos para desplegar el proyecto en tu entorno de desarrollo local:

1. **Clona el repositorio:**
   ```bash
   git clone [https://github.com/tu-usuario/dorepy.git](https://github.com/tu-usuario/dorepy.git)
   cd dorepy

```

2. **Instala las dependencias:**
```bash
npm install

```


3. **Configura las Variables de Entorno:**
Crea un archivo `.env` en la raíz del proyecto y agrega las siguientes variables. Asegúrate de colocar tus propias credenciales:
```env
PORT=3000
MONGODB_URI=mongodb+srv://<usuario>:<password>@cluster.mongodb.net/dorepy
SESSION_SECRET=TuSecretoSuperSeguro
GEMINI_API_KEY=TuClaveDeGoogleGemini

```


4. **Inicia el servidor:**
```bash
npm start
# o si usas nodemon para desarrollo:
npm run dev

```


5. **Accede a la aplicación:**
Abre tu navegador web y dirígete a `http://localhost:3000`.

## 📡 API Endpoints Principales

* `POST /login`: Autenticación de administradores para acceder al dashboard.
* `POST /api/metrics`: Ruta pública para que los equipos cliente (dispositivos IoT) envíen sus lecturas de sensores (CPU, RAM, GPU, Procesos).
* `GET /api/report/:id`: Retorna el reporte generado por la IA para un dispositivo específico.

## 🤖 Arquitectura del Agente de IA

El sistema utiliza un Cron Job configurado para evaluar el historial de métricas de los dispositivos. Al ejecutarse, extrae los promedios matemáticos y los procesos persistentes de la base de datos, estructurando un *prompt* dinámico. Este paquete de datos se envía al modelo generativo para recibir un análisis técnico del comportamiento del hardware y se guarda automáticamente para su consulta histórica.
