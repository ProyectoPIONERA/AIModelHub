# ML Models Browser

Componente standalone de Angular 17 para explorar, gestionar y crear assets de Machine Learning en un espacio de datos basado en Eclipse Dataspace Connector (EDC).

## 📋 Tabla de Contenidos

- [Características](#características)
- [Requisitos Previos](#requisitos-previos)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Uso](#uso)
- [Desarrollo](#desarrollo)
- [Testing](#testing)
- [Arquitectura](#arquitectura)
- [Integración EDC](#integración-edc)

## ✨ Características

### Gestión de Assets ML
- **Browser de ML Assets**: Visualización en grid/lista de modelos de Machine Learning
- **Creación de Assets**: Formulario completo con validación para crear nuevos assets ML
- **Detalles de Asset**: Vista detallada de cada asset con toda su metadata
- **Filtros avanzados**: Por tipo de storage, formato, task ML, etc.

### Metadata ML (JS_Pionera_Ontology)
- **Vocabulario Dinámico**: Carga de opciones desde JSON-LD
- **7 Campos ML**:
  - Task (10 opciones)
  - Subtask (25 opciones)
  - Algorithm (27 opciones)
  - Library (19 opciones)
  - Framework (12 opciones)
  - Software (21 opciones)
  - Format (15 opciones)

### Navegación y UI
- **Layout Responsive**: Sidebar con menú, toolbar superior
- **4 Secciones**: ML Assets Browser, Create ML Asset, Catalog, Contracts
- **Material Design**: Angular Material 17 con tema personalizado

## 📦 Requisitos Previos

- Node.js >= 18.x
- npm >= 9.x
- Angular CLI 17.x
- EDC Connector running

## 🚀 Instalación

```bash
cd IAModelHub/IAModelHub_EDCUI/ml-browser-app
npm install
```

## ⚙️ Configuración

Editar `src/environments/environment.ts`:

```typescript
export const environment = {
  runtime: {
    managementApiUrl: 'http://localhost:19193/management',
    catalogUrl: 'http://localhost:19193/management/federatedcatalog',
    participantId: 'connector-demo'
  }
};
```

## 🎯 Uso

### Desarrollo

```bash
npm start
# Abre http://localhost:4200
```

### Producción

```bash
npm run build
# Archivos en dist/ml-browser-app/
```

## 🧪 Testing

```bash
npm test                 # Tests unitarios
npm run test:coverage   # Con cobertura
```

## 📝 Documentación Completa

Ver `README.md` original para documentación extendida.
