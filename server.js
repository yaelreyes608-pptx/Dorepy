require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cron = require('node-cron');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json()); 
app.use(express.urlencoded({ extended: false }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'Ysayle',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB Conectado (Auth + Metrics)'))
    .catch(err => console.error('Error DB:', err));

const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true }
}));

const Report = mongoose.model('Report', new mongoose.Schema({
    deviceId: { type: String, required: true },
    content: String,
    timestamp: { type: Date, default: Date.now }
}));

const Metric = mongoose.model('Metric', new mongoose.Schema({
    deviceId: { type: String, required: true },
    cpu: Number, ram: Number, gpu: Number, top_procesos: Array,
    timestamp: { type: Date, default: Date.now }
}));

passport.use(new LocalStrategy(async (username, password, done) => {
    try {
        const user = await User.findOne({ username });
        if (!user) return done(null, false, { message: 'Usuario o contraseña incorrectos' });
        
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return done(null, false, { message: 'Usuario o contraseña incorrectos' });
        
        return done(null, user);
    } catch (err) { return done(err); }
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) { done(err); }
});

app.use(express.static(path.join(__dirname, 'public')));

app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        await new User({ username, password: hashedPassword }).save();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ success: false, message: info.message });
        
        req.logIn(user, (err) => {
            if (err) return res.status(500).json({ error: err.message });
            return res.json({ success: true, redirect: '/dashboard' });
        });
    })(req, res, next);
});

function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/');
}

app.get('/dashboard', checkAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard', 'dashboard.html'));
});

app.get('/api/devices', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    try {
        const devices = await Metric.distinct('deviceId');
        res.json(devices);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener dispositivos" });
    }
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

app.post('/api/metrics', async (req, res) => {
    try {
        const data = req.body;

        const { deviceId } = data; 

        if (!deviceId) return res.status(400).json({ error: "Falta deviceId" });

        io.emit('data_update', data);

        const newMetric = new Metric(data);
        await newMetric.save();

        res.status(200).json({ status: 'ok, guardado en BD' });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

app.get('/api/metrics/today', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    
    const { deviceId } = req.query;
    if (!deviceId) return res.status(400).json({ error: "Se requiere un deviceId" });
    const inicioDia = new Date();
    inicioDia.setHours(0, 0, 0, 0);

    try {
        const metricas = await Metric.find({
            deviceId: deviceId,
            timestamp: { $gte: inicioDia }
        }).sort({ timestamp: 1 });
        res.json(metricas);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener historial" });
    }
});

app.get('/api/reports', async (req, res) => {
    const { deviceId } = req.query;
    if (!deviceId) return res.status(400).json({ error: "Se requiere un deviceId" });
    try {
        const reports = await Report.find({ deviceId: deviceId }, 'timestamp content').sort({ timestamp: -1 });
        res.json(reports);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/report/:id', async (req, res) => {
    try {
        const report = await Report.findById(req.params.id);
        res.json(report);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

cron.schedule('* * * * *', async () => {
    console.log("Iniciando análisis...");
    const hace12h = new Date(Date.now() - 12 * 60 * 60 * 1000);
    
    try {
        const dispositivosActivos = await Metric.distinct('deviceId', { timestamp: { $gte: hace12h } });
        
       for (const deviceId of dispositivosActivos) {
            const logs = await Metric.find({ deviceId: deviceId, timestamp: { $gte: hace12h } });
            
            if (logs.length > 0) {
                let totalCpu = 0; let totalRam = 0; let totalGpu = 0;
                let historialProcesos = {};

                logs.forEach(log => {
                    totalCpu += log.cpu || 0;
                    totalRam += log.ram || 0;
                    totalGpu += log.gpu || 0;

                    if (log.top_procesos && log.top_procesos.length > 0) {
                        log.top_procesos.forEach(p => {
                            if (!historialProcesos[p.nombre]) {
                                historialProcesos[p.nombre] = { apariciones: 0, cpuSumada: 0 };
                            }
                            historialProcesos[p.nombre].apariciones += 1;
                            historialProcesos[p.nombre].cpuSumada += parseFloat(p.cpu);
                        });
                    }
                });

                const avgCpu = (totalCpu / logs.length).toFixed(2);
                const avgRam = (totalRam / logs.length).toFixed(2);
                const avgGpu = (totalGpu / logs.length).toFixed(2);

                const topHistorico = Object.keys(historialProcesos).map(nombre => {
                    const stats = historialProcesos[nombre];
                    return {
                        programa: nombre,
                        frecuencia: ((stats.apariciones / logs.length) * 100).toFixed(1),
                        pesoPromedio: (stats.cpuSumada / stats.apariciones).toFixed(1)
                    };
                }).sort((a, b) => b.pesoPromedio - a.pesoPromedio).slice(0, 3);

                const prompt = `Actúa como un analista de sistemas automatizado.
                Analiza esta telemetría del equipo ${deviceId} y redacta un reporte técnico.
                
                REGLA ESTRICTA DE FORMATO: 
                Tu respuesta debe ser exclusivamente en TEXTO PLANO. Está estrictamente prohibido usar emojis, formato Markdown, asteriscos (**) o hashtags (#). Usa guiones medios (-) para las viñetas. No agregues saludos ni despedidas.
                
                Sigue exactamente esta plantilla para redactar tu respuesta rellenando los datos:
                
                Reporte de Telemetria y Analisis de Procesos - Equipo: ${deviceId}
                
                - El equipo ${deviceId} muestra un estado operativo [Indica si es saludable/estable o si hay riesgo] tras procesar un total de ${logs.length} lecturas de telemetria, registrando un uso promedio de recursos: CPU al ${avgCpu}%, RAM al ${avgRam}% y GPU al ${avgGpu}%, lo que indica [Conclusión breve sobre estos niveles].
                
                - El proceso con mayor presencia en el sistema es ${topHistorico[0] ? topHistorico[0].programa : 'N/A'}, manteniendose activo el ${topHistorico[0] ? topHistorico[0].frecuencia : '0'}% del tiempo de medicion. Este archivo pertenece al software comercial [Busca a qué software pertenece], y su funcion principal es [Explica su función brevemente].
                
                - Se detectaron otros procesos activos como ${topHistorico[1] ? `${topHistorico[1].programa} (activo el ${topHistorico[1].frecuencia}%)` : 'N/A'} y ${topHistorico[2] ? `${topHistorico[2].programa} (activo el ${topHistorico[2].frecuencia}%)` : 'N/A'}. ${topHistorico[1] ? topHistorico[1].programa : ''} corresponde a la aplicacion [Software y función], mientras que ${topHistorico[2] ? topHistorico[2].programa : ''} pertenece a [Software y función].`;

                const result = await model.generateContent(prompt);
                const reportText = result.response.text();
                
                await new Report({ deviceId: deviceId, content: reportText }).save();

                io.emit('report_update', { deviceId: deviceId, content: reportText });
                
                console.log(`\nReporte generado exitosamente para: ${deviceId}`);
            }
        }
    } catch (error) {
        console.error("Error generando reportes masivos:", error);
    }
}, {
    scheduled: true,
    timezone: "America/Mexico_City"
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
