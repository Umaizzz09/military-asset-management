# Military Asset Management System

A full-stack Military Asset Management System developed as a take-home assignment for Kristalball.

The application provides secure management of military assets across multiple bases, including inventory, purchases, transfers, assignments, expenditures, dashboard reporting, role-based access control, authentication, and audit logging.

---

## Live Application

### Frontend
https://military-asset-management-omega-five.vercel.app

### Backend API
https://military-asset-management-b9xx.onrender.com

### Database
PostgreSQL hosted on Neon

---

## Features

- Secure authentication using JWT
- Role-Based Access Control (RBAC)
- Base-level authorization
- Asset inventory management
- Purchase management
- Inter-base asset transfers
- Asset assignments
- Asset expenditures
- Dashboard with inventory movement
- Date, base, and equipment filters
- Audit logging
- Input validation
- Error handling
- Transactional database operations
- PostgreSQL database
- Responsive professional user interface

---

## User Roles

### Admin

Full access to the system.

Access includes:

- Dashboard
- Inventory
- Purchases
- Transfers
- Assignments
- Expenditures
- Audit Logs

### Base Commander

Access is restricted to the assigned base.

Capabilities include:

- View inventory for assigned base
- View relevant dashboard information
- Create asset assignments
- Record expenditures
- View relevant records

### Logistics Officer

Capabilities include:

- View inventory
- Create purchases
- View purchase history
- Create transfers
- View transfer history

Assignments and expenditures are restricted for the Logistics Officer role.

---

## Dashboard

The dashboard provides:

- Opening Balance
- Closing Balance
- Net Movement
- Assigned Assets
- Expended Assets

### Filters

- Date
- Base
- Equipment Type

### Net Movement Details

- Purchases
- Transfer In
- Transfer Out

---

## Inventory Management

The inventory module manages assets across different military bases.

Each asset is associated with:

- Base
- Equipment Type
- Asset Code
- Quantity
- Status

The system prevents inventory quantities from becoming negative through application validation and database constraints.

---

## Purchases

Authorized users can record new purchases.

Purchase information includes:

- Base
- Equipment Type
- Quantity
- Purchase Date
- Reference Number
- Notes

A successful purchase updates the corresponding asset inventory.

---

## Transfers

The system supports transfers of assets between military bases.

Transfer information includes:

- Source Base
- Destination Base
- Equipment Type
- Quantity
- Transfer Date
- Reference Number
- Notes

Transfers are performed inside a PostgreSQL database transaction.

The transaction ensures that:

1. Source inventory is locked.
2. Available quantity is checked.
3. Source quantity is decreased.
4. Destination inventory is created or updated.
5. Transfer record is created.
6. Audit log is created.
7. All changes are committed together.

If an error occurs, the transaction is rolled back.

---

## Assignments

Assets can be assigned to personnel.

Assignment information includes:

- Asset
- Personnel Name
- Quantity
- Assigned Date
- Returned Date
- Notes

Before an assignment is recorded, the system checks whether sufficient inventory is available.

---

## Expenditures

Assets can be recorded as expended.

Expenditure information includes:

- Base
- Equipment Type
- Quantity
- Expenditure Date
- Reason

The system validates inventory availability before recording the expenditure.

---

## Audit Logging

Important system actions are recorded in the audit log.

Logged actions include:

- Purchases
- Transfers
- Assignments
- Expenditures

Audit records contain:

- User
- Action
- Entity Type
- Entity ID
- Details
- IP Address
- Timestamp

---

## Authentication and Security

The backend implements:

- JWT-based authentication
- Password hashing using bcrypt
- Role-based authorization
- Base-level authorization
- Protected API routes
- Input validation
- Error handling
- CORS configuration
- PostgreSQL constraints
- Transactional database operations

Sensitive configuration is stored using environment variables.

Example environment variables:

```env
DATABASE_URL=YOUR_DATABASE_URL
JWT_SECRET=YOUR_SECRET_KEY
CORS_ORIGIN=YOUR_FRONTEND_URL
```

`.env` files are excluded from Git using `.gitignore`.

---

## Technology Stack

### Frontend

- React
- Vite
- JavaScript
- CSS

### Backend

- Node.js
- Express.js
- PostgreSQL
- JWT
- bcryptjs
- CORS

### Database

- PostgreSQL
- Neon

### Deployment

- Vercel - Frontend
- Render - Backend
- Neon - PostgreSQL Database

---

## System Architecture

```text
                   ┌───────────────────────┐
                   │      User Browser      │
                   └───────────┬───────────┘
                               │
                               │ HTTPS
                               ▼
                   ┌───────────────────────┐
                   │        Vercel         │
                   │   React + Vite App    │
                   └───────────┬───────────┘
                               │
                               │ REST API
                               ▼
                   ┌───────────────────────┐
                   │        Render         │
                   │ Node.js + Express API │
                   └───────────┬───────────┘
                               │
                               │ PostgreSQL
                               ▼
                   ┌───────────────────────┐
                   │         Neon          │
                   │    PostgreSQL DB      │
                   └───────────────────────┘
```

---

## Database Schema

The application uses the following PostgreSQL tables:

```text
roles
bases
users
equipment_types
assets
purchases
transfers
assignments
expenditures
audit_logs
```

### Relationship Overview

```text
roles
  │
  └── users
       ├── purchases
       ├── transfers
       ├── assignments
       └── expenditures

bases
  ├── assets
  ├── purchases
  ├── transfers
  └── expenditures

equipment_types
  ├── assets
  ├── purchases
  ├── transfers
  └── expenditures

assets
  └── assignments

users
  └── audit_logs
```

---

## Project Structure

```text
military-asset-management/
│
├── backend/
│   ├── src/
│   │   ├── app.js
│   │   ├── db.js
│   │   ├── authRoutes.js
│   │   ├── authMiddleware.js
│   │   ├── roleMiddleware.js
│   │   ├── baseMiddleware.js
│   │   ├── assetRoutes.js
│   │   ├── purchaseRoutes.js
│   │   ├── transferRoutes.js
│   │   ├── assignmentRoutes.js
│   │   ├── expenditureRoutes.js
│   │   ├── dashboardRoutes.js
│   │   ├── baseRoutes.js
│   │   ├── equipmentTypeRoutes.js
│   │   └── auditRoutes.js
│   │
│   ├── package.json
│   ├── package-lock.json
│   └── .gitignore
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   │
│   ├── public/
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.js
│
├── database_dump.sql
└── README.md
```

---

## API Endpoints

### Authentication

```text
POST /api/auth/login
```

### Assets

```text
GET /api/assets
```

### Purchases

```text
GET  /api/purchases
POST /api/purchases
```

### Transfers

```text
GET  /api/transfers
POST /api/transfers
```

### Assignments

```text
GET  /api/assignments
POST /api/assignments
```

### Expenditures

```text
GET  /api/expenditures
POST /api/expenditures
```

### Dashboard

```text
GET /api/dashboard/summary
GET /api/dashboard/movement
```

### Bases

```text
GET /api/bases
```

### Equipment Types

```text
GET /api/equipment-types
```

### Audit Logs

```text
GET /api/audit-logs
```

### Health Check

```text
GET /api/health/db
```

---

## Local Setup

### Prerequisites

Install:

- Node.js
- npm
- PostgreSQL

---

## Backend Setup

Open a terminal:

```bash
cd backend
npm install
```

Create a `.env` file inside the `backend` directory:

```env
PORT=5000
DB_USER=postgres
DB_HOST=localhost
DB_NAME=military_asset_db
DB_PASSWORD=YOUR_POSTGRES_PASSWORD
DB_PORT=5432
JWT_SECRET=YOUR_SECRET_KEY
CORS_ORIGIN=http://localhost:5173
```

Start the backend:

```bash
npm run dev
```

The backend will run at:

```text
http://localhost:5000
```

---

## Frontend Setup

Open another terminal:

```bash
cd frontend
npm install
```

Create a `.env` file inside the `frontend` directory:

```env
VITE_API_URL=http://localhost:5000/api
```

Start the frontend:

```bash
npm run dev
```

The frontend will run at:

```text
http://localhost:5173
```

---

## Database Setup

Create a PostgreSQL database named:

```text
military_asset_db
```

Then import:

```text
database_dump.sql
```

The database dump contains:

- Database schema
- Roles
- Bases
- Equipment types
- Demo users
- Seed data

---

## Deployment Configuration

### Frontend - Vercel

```text
Root Directory: frontend
Framework: Vite
```

Production API URL:

```env
VITE_API_URL=https://military-asset-management-b9xx.onrender.com/api
```

### Backend - Render

```text
Root Directory: backend
Build Command: npm install
Start Command: npm start
```

Required environment variables:

```text
DATABASE_URL
JWT_SECRET
CORS_ORIGIN
```

### Database - Neon

The backend connects to the Neon PostgreSQL database using:

```text
DATABASE_URL
```

---

## Testing Performed

The deployed application was tested for:

- Admin login
- Base Commander login
- Logistics Officer login
- Dashboard loading
- Purchase creation
- Transfer creation
- Inventory updates
- Role-based access control
- Base-level access control
- Audit logging
- PostgreSQL database connectivity
- Vercel frontend connectivity
- Render backend connectivity

---

## Assignment Requirements Covered

```text
✓ Dashboard
✓ Inventory Management
✓ Purchases
✓ Transfers
✓ Assignments
✓ Expenditures
✓ Authentication
✓ Role-Based Access Control
✓ Base-Level Authorization
✓ Input Validation
✓ Error Handling
✓ Audit Logging
✓ Transactional Transfers
✓ PostgreSQL Database
✓ Cloud Deployment
✓ Database Dump
```

---

## Demo Credentials

### Admin

```text
Email: admin@militaryasset.com
Password: Admin@123
```

### Base Commander - Alpha

```text
Email: commander.alpha@militaryasset.com
Password: Commander@123
```

### Base Commander - Bravo

```text
Email: commander.bravo@militaryasset.com
Password: Commander@123
```

### Base Commander - Charlie

```text
Email: commander.charlie@militaryasset.com
Password: Commander@123
```

### Logistics Officer

```text
Email: logistics@militaryasset.com
Password: Logistics@123
```

> These are demo credentials for evaluation of the assignment. For a production system, credentials should be managed securely and never exposed in a public repository.

---

## Author

**Mohammed Umaiz**

B.E. – Artificial Intelligence & Machine Learning

### GitHub

https://github.com/Umaizzz09

### Repository

https://github.com/Umaizzz09/military-asset-management