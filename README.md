Sistema de Monitoreo de Recursos con IA e IoT

Esta plataforma está diseñada para supervisar el rendimiento de computadoras personales mediante la integración de Internet de las Cosas y modelos de Inteligencia Artificial. El sistema transforma una máquina convencional en un dispositivo inteligente capaz de reportar su estado de salud de manera constante y remota, permitiendo al usuario tomar decisiones informadas sobre el mantenimiento de su hardware.  

Funcionamiento Técnico y Arquitectura

El núcleo del proyecto se basa en un agente de software ligero que utiliza conceptos de IoT para recolectar métricas críticas en tiempo real, tales como la carga del procesador, el consumo de memoria RAM, el rendimiento de la tarjeta gráfica y las temperaturas internas. Estos datos se transmiten a través de protocolos de internet a un servidor centralizado, lo que habilita un panel de control accesible desde cualquier navegador.  

La inteligencia artificial actúa como el motor de análisis del sistema, procesando datos históricos para identificar patrones de uso o anomalías, como procesos con consumo excesivo de energía o picos de temperatura inusuales. Basándose en este análisis, el sistema genera recomendaciones personalizadas que incluyen el cierre de aplicaciones innecesarias o sugerencias de mantenimiento físico y actualizaciones de componentes.  

Estructura del Proyecto

La arquitectura de programación garantiza una comunicación rápida y segura, permitiendo un flujo de datos continuo y notificaciones inmediatas. El repositorio está organizado para separar la lógica de recolección de datos del procesamiento de IA y la interfaz de usuario:  


Agente de Monitoreo: Software encargado de la telemetría del hardware.  

Servidor Central: Gestiona la recepción de datos y la comunicación con la IA.  

Interfaz Web: Panel de control para la visualización remota del estado del equipo.  

Motor de IA: Analiza la información para generar reportes y recomendaciones preventivas.  

Instalación y Configuración

Para poner en marcha el sistema, es necesario clonar el repositorio e instalar las dependencias tanto en el agente local como en el servidor. Se requiere configurar la conexión con la API de IA seleccionada y asegurar que los protocolos de red permitan el envío de la telemetría al servidor central. Este enfoque integral no solo facilita la gestión técnica, sino que extiende la vida útil de los dispositivos mediante un mantenimiento preventivo basado en datos reales.
