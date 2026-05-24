const si = require('systeminformation');
const axios = require('axios');
const notifier = require('node-notifier');
const os = require('os');
const path = require('path');

const API_URL = 'https://dorepy-ba1bf90a041c.herokuapp.com/api/metrics';

const nombreEquipo = os.hostname();

async function enviarDatos() {
    try {
        const cpu = await si.currentLoad();
        const mem = await si.mem();
        const gpuData = await si.graphics();
        const proc = await si.processes();

        let gpuUso = 0;
        if (gpuData.controllers && gpuData.controllers.length > 0) {
            gpuUso = gpuData.controllers[0].utilizationGpu || 0;
        }

        const top3 = proc.list
            .filter(p => p.name !== 'System Idle Process')
            .sort((a, b) => b.cpu - a.cpu)
            .slice(0, 3)
            .map(p => ({ nombre: p.name, cpu: p.cpu.toFixed(1) }));

        const payload = {
            deviceId: nombreEquipo,
            cpu: parseFloat(cpu.currentLoad.toFixed(2)),
            ram: parseFloat(((mem.used / mem.total) * 100).toFixed(2)),
            gpu: parseFloat(gpuUso),
            top_procesos: top3
        };

        await axios.post(url, payload);
        console.log(`[${new Date().toLocaleTimeString()}] [${nombreEquipo}] Enviado -> CPU: ${payload.cpu}% | RAM: ${payload.ram}% | GPU: ${payload.gpu}%`);

    } catch (e) {
        console.log("Servidor no disponible. Reintentando...");
    }
}

console.log("Dorepy activo. Enviando datos...");
setInterval(enviarDatos, 30000);


setInterval(async () => {
    try {
        const cpuData = await si.currentLoad();
        const memData = await si.mem();

        const cpu = parseFloat(cpuData.currentLoad.toFixed(2));
        const ram = parseFloat(((memData.used / memData.total) * 100).toFixed(2));

        let titulo = 'Dorepy: Sistema Estable';
        let mensaje = `Todo en niveles normales. (CPU: ${cpu}% | RAM: ${ram}%)`;

        if (cpu > 70 || ram > 75) {
            titulo = 'Dorepy: ALERTA DE CONSUMO';
            mensaje = `¡Revisa los procesos! Consumo alto detectado (CPU: ${cpu}% | RAM: ${ram}%)`;
        }

        notifier.notify({
            title: titulo,
            message: mensaje,
            sound: true,
            wait: false,
            icon: path.join(__dirname, 'dorepy.png')
        });
        
        console.log(`\n[!] Notificación de escritorio enviada: ${titulo}\n`);

    } catch (error) {
        console.error("Error al generar la notificación:", error);
    }
}, 15 * 60 * 1000); //15min