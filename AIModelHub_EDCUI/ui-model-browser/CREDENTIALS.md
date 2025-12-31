# Access Credentials - AI EDC Connector

## System Users

### User 1: User1 Demo Connector
- **Username:** `user-conn-user1-demo`
- **Password:** `user1123`
- **Connector ID:** `conn-user1-demo`
- **Display Name:** User1 Demo Connector

### User 2: User2 Demo Connector  
- **Username:** `user-conn-user2-demo`
- **Password:** `user2123`
- **Connector ID:** `conn-user2-demo`
- **Display Name:** User2 Demo Connector

## Access URLs

- **Frontend:** http://localhost:4200
- **Backend API:** http://localhost:3000
- **Health Check:** http://localhost:3000/health

## Main Endpoints

- **Login:** POST http://localhost:3000/auth/login
- **Assets:** POST http://localhost:3000/v3/assets/request
- **Vocabulary:** GET http://localhost:3000/vocabulary

## Note

Passwords are stored hashed in the database using bcrypt.
To change passwords, use the corresponding migration script.
