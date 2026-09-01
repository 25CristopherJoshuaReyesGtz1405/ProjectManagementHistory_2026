# 🏛️ SIGAH - Sistema Integral de Gestión de Archivos Históricos

> Plataforma tecnológica de vanguardia diseñada para digitalizar, salvaguardar y automatizar la consulta operativa de más de 60,000 expedientes históricos del **Instituto Tecnológico de Durango (ITD)**.

---

## 📋 Descripción del Proyecto

Este sistema implementa una arquitectura en la nube para erradicar la obsolescencia de los métodos de búsqueda manuales (tarjetas bibliográficas). Sustituye los registros físicos vulnerables al deterioro por un **"Gemelo Digital"**, garantizando tiempos de respuesta ultrarrápidos, trazabilidad forense inalterable y el cumplimiento riguroso de la Ley General de Archivos en México.

### 🎯 Objetivos Estratégicos
* **Preservación Institucional:** Salvaguardar la historia académica de miles de egresados ante riesgos de deterioro mecánico o ambiental.
* **Eficiencia Operativa:** Reducir los tiempos de localización de información de días hábiles a fracciones de segundo.
* **Trazabilidad y Auditoría:** Cumplimiento legal a través del "Principio de Inalterabilidad Histórica", registrando cada acceso y modificación al acervo.
* **Control Topográfico:** Vincular de forma precisa el expediente virtual con su ubicación física exacta en los anaqueles.

---

## 🌟 Módulos y Funcionalidades

El sistema se compone de módulos funcionales críticos diseñados para optimizar el trabajo en el Departamento de Servicios Escolares:

### 1. 🛡️ Core Security y Auditoría Forense
Encargado de la protección perimetral e interna de la información confidencial.

* **👥 Control de Acceso (RBAC):** Gestión jerárquica de permisos para perfiles de Administrador, Jefatura, Operador/Capturista y Auditor.
* **🔐 Bitácora Inmutable (Audit Logs):** Registro automático y detallado (identificador, timestamp, dirección IP y snapshot de cambios) de cualquier operación (CRUD) realizada en los expedientes históricos.

### 2. 🗃️ Gestión del Acervo y Digitalización
Herramientas ergonómicas diseñadas para asimilar volúmenes masivos de datos.

* **⚡ Captura de Alta Velocidad (Data Entry):** Interfaz optimizada para transcripción rápida mediante atajos de teclado, ideal para los prestadores de Servicio Social.
* **🚀 Importación Masiva (Bulk Import):** Motor de ingesta capaz de procesar archivos **CSV** con algoritmos de sanitización para evitar matrículas o registros duplicados.
* **📄 Visor Seguro:** Previsualización de documentos (PDFs, Actas) bloqueando descargas no autorizadas.

### 3. 🔖 Circulación y Control Topográfico
Gestión del mundo "Phygital" (físico y digital).

* **🔍 Búsqueda Reactiva:** Motor de búsqueda en el cliente con latencia menor a 200 milisegundos mediante coincidencia parcial de cadenas.
* **🖨️ Etiquetas QR y OCR:** Generación automática de etiquetas PDF con códigos QR que, al escanearse, abren el expediente digital correspondiente a la caja física.
* **📂 Vales de Préstamo Digitales:** Emisión dinámica de documentos PDF para formalizar la cadena de custodia al extraer un expediente físico.

### 4. 📈 Módulo de Inteligencia de Negocios (BI)
Panel de control para la Jefatura del Departamento.

* **📊 Dashboard Ejecutivo (KPIs):**
  *   *Monitoreo en tiempo real del progreso de digitalización del acervo.*
  *   *Métricas de productividad por capturista.*
  *   *Alertas automáticas de préstamos de expedientes físicos vencidos.*
  *   *Análisis de inventario para detectar saltos o huecos en folios históricos.*

---

## 🛠️ Stack Tecnológico

El proyecto está construido bajo una arquitectura cliente-servidor estructurada en un monorepositorio (Stack MEAN + Firebase), orientada a eventos y funciones Serverless.

| Componente | Tecnología | Descripción |
| :--- | :--- | :--- |
| **Frontend** | ![Angular](https://img.shields.io/badge/-Angular-DD0031?logo=angular&logoColor=white) | SPA de alto rendimiento, TypeScript, SCSS, RxJS y Angular Material. |
| **Backend** | ![NodeJS](https://img.shields.io/badge/-Node.js-339933?logo=node.js&logoColor=white) | Node.js con Express.js operando como Middleware de seguridad. |
| **Base de Datos** | ![Firestore](https://img.shields.io/badge/-Firestore-FFCA28?logo=firebase&logoColor=black) | Cloud Firestore (NoSQL) para flexibilidad de esquema y consultas en tiempo real. |
| **Autenticación** | ![Firebase Auth](https://img.shields.io/badge/-Auth-FFCA28?logo=firebase&logoColor=black) | Control seguro de identidades e integraciones de roles. |
| **Almacenamiento** | ![Google Cloud](https://img.shields.io/badge/-Google_Cloud-4285F4?logo=google-cloud&logoColor=white) | Cloud Storage para el resguardo encriptado de expedientes físicos digitalizados. |

### 🔒 Pruebas y Aseguramiento de Calidad
* **Auditoría E2E:** Pruebas funcionales de extremo a extremo y comprobación de latencia sobre la red del ITD.
* **Persistencia Offline:** Integración de *Service Workers* para permitir la sincronización diferida de captura en caso de fallos de red.
* **Análisis de Vulnerabilidades:** Mitigación de riesgos *Zero-Day* usando herramientas de auditoría en el entorno MEAN.

---

## 💻 Instalación y Despliegue Local

### Prerrequisitos
* Node.js (v18 LTS o superior)
* Angular CLI
* Firebase CLI
* Credenciales de servicio de Google Cloud / Firebase.

### Pasos de Instalación

1.  **Clonar el repositorio:**
    
```bash
    git clone [https://github.com/25CristopherJoshuaReyesGtz1405/ProjectManagementHistory_2026.git](https://github.com/25CristopherJoshuaReyesGtz1405/ProjectManagementHistory_2026.git)
```

2.  **Configurar Backend:**

```bash
    cd Backend/functions
    npm install
    # Configurar archivo .env o GestionHistorica.json con las credenciales
    npm run build
```
    
3.   **Configurar Frontend:**

```bash
    cd Frontend
    npm install
    ng serve
```
 
**Acceso:** Navegar a http://localhost:4200/.

---

## 📄 Licencia e Información del Proyecto

**Versión:** 2.1
**Estado:** En proceso de verificación (Pruebas E2E).

*Cristopher Joshua Reyes Gutiérrez - Desarrollador Full-Stack & Project Manager (Autor Intelectual y Líder Técnico Full-Stack).*

**Propiedad Patrimonial:** Instituto Tecnológico de Durango (ITD) - Departamento de Servicios Escolares.
**Licencia:** Exclusiva / Desarrollado utilizando tecnologías Open Source.

---

Desarrollado como Proyecto de Residencia Profesional para la Carrera de Ingeniería en Sistemas Computacionales.
