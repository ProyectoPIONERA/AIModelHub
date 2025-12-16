# Credenciales de Acceso - IA EDC Connector

## Usuarios del Sistema

### Usuario 1: OEG Demo Connector
- **Username:** `user-conn-oeg-demo`
- **Password:** `a!ulzZ5dJvLJSzvM`
- **Connector ID:** `conn-oeg-demo`
- **Display Name:** OEG Demo Connector

### Usuario 2: Edmundo Demo Connector  
- **Username:** `user-conn-edmundo-demo`
- **Password:** `D1S*ty@!UFTmr6U^`
- **Connector ID:** `conn-edmundo-demo`
- **Display Name:** Edmundo Demo Connector

## URLs de Acceso

- **Frontend:** http://localhost:4200
- **Backend API:** http://localhost:3000
- **Health Check:** http://localhost:3000/health

## Endpoints Principales

- **Login:** POST http://localhost:3000/auth/login
- **Assets:** POST http://localhost:3000/v3/assets/request
- **Vocabulary:** GET http://localhost:3000/vocabulary

## Nota

Las contraseñas están hasheadas en la base de datos usando bcrypt.
Para cambiar contraseñas, usa el script de migración correspondiente.
