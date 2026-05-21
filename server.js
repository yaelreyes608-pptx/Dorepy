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
    content: String,
    timestamp: { type: Date, default: Date.now }
}));

const Metric = mongoose.model('Metric', new mongoose.Schema({
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

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

app.post('/api/metrics', async (req, res) => {
    try {
        const newMetric = new Metric(req.body);
        await newMetric.save();
        io.emit('data_update', req.body); 
        res.status(201).json({ status: 'ok' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/metrics/today', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    
    const inicioDia = new Date();
    inicioDia.setHours(0, 0, 0, 0);

    try {
        const metricas = await Metric.find({
            timestamp: { $gte: inicioDia }
        }).sort({ timestamp: 1 });
        res.json(metricas);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener historial" });
    }
});

app.get('/api/reports', async (req, res) => {
    try {
        const reports = await Report.find({}, 'timestamp').sort({ timestamp: -1 });
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

cron.schedule('0 0,12 * * *', async () => {
    console.log("Iniciando análisis...");
    const hace12h = new Date(Date.now() - 12 * 60 * 60 * 1000);
    
    try {
        const logs = await Metric.find({ timestamp: { $gte: hace12h } });
        
        if (logs.length > 0) {
            let totalCpu = 0;
            let totalRam = 0;
            let totalGpu = 0;
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

            const prompt = `
            Actúa como un analista de sistemas automatizado.
            Analiza esta telemetría y redacta un reporte que será entregado dos veces al día, en 3-4 viñetas técnicas.
            Analiza estos procesos. Para cada nombre de archivo detectado (ej. 'code.exe'), busca en internet a qué software comercial corresponde y úsalo en el reporte (ej. 'Visual Studio Code'). Si es un proceso del sistema de Windows, explícame brevemente qué función cumple.
            Entrega el reporte en un texto simple.
            
            DATOS GLOBALES DEL SISTEMA:
            - Lecturas totales: ${logs.length}
            - CPU Promedio General: ${avgCpu}%
            - RAM Promedio General: ${avgRam}%
            - GPU Promedio General: ${avgGpu}%
            
            TOP 3 PROGRAMAS PERSISTENTES HOY:
            1. ${topHistorico[0] ? `${topHistorico[0].programa} (Activo ${topHistorico[0].frecuencia}% del tiempo)` : 'N/A'}
            2. ${topHistorico[1] ? `${topHistorico[1].programa} (Activo ${topHistorico[1].frecuencia}% del tiempo)` : 'N/A'}
            3. ${topHistorico[2] ? `${topHistorico[2].programa} (Activo ${topHistorico[2].frecuencia}% del tiempo)` : 'N/A'}
            `;

            const result = await model.generateContent(prompt);
            const reportText = result.response.text();
            await new Report({ content: reportText }).save();
            io.emit('report_update', { content: reportText });
            console.log("\nREPORTE DIARIO POR LA IA:\n=========================");
            console.log(result.response.text());
            console.log("=========================\n");
        } else {
            console.log("No hay datos suficientes para el reporte de hoy.");
        }
    } catch (error) {
        console.error("Error generando el reporte:", error);
    }
}, {
    scheduled: true,
    timezone: "America/Mexico_City"
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});