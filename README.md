# Jivdani Vegetable Suppliers (JVSapp)

A B2B digital ordering platform for **Jivdani Vegetable Suppliers** where registered restaurants can log in, place daily orders, and view billing history. The admin dashboard manages daily market rates, approvals, and order confirmations.

## Features
- **Restaurant Portal**: Register/login, place orders with real-time bill calculation, view order history, ledger, and outstanding balances.
- **Admin Dashboard**: Update daily market rates in bulk, approve restaurant registrations, adjust rates per order, record payments, and view daily consolidated purchase summaries.
- **Order Cut-Off**: Time-based lock for order submission to freeze supply lists for morning purchases.

---

## Getting Started (Local Development)

### Prerequisites
- Docker & Docker Compose
- Python 3.10+ (for manual execution)
- Node.js & Yarn (for frontend manual execution)

### Running Stack locally
1. Copy the environment variables template:
   ```bash
   cp .env.example .env
   ```
2. Configure `.env` values (set site addresses, DB, and admin logins).
3. Start the application:
   ```bash
   docker-compose up -d --build
   ```
4. Access:
   - Frontend: `http://localhost`
   - Backend API: `http://localhost/api` (reverse proxied via Caddy)

---

## Deployment & Updates (Production Server)

### Remote Host
- **IP Address**: `http://45.196.196.114`
- **Root Directory**: `/root/JVSapp`

### Running Updates
When code updates are made to the repository:
1. Commit and push your changes to GitHub.
2. SSH into the remote server:
   ```bash
   ssh root@45.196.196.114
   # Enter password
   ```
3. Navigate to the repository and run the deploy helper script:
   ```bash
   cd /root/JVSapp
   ./deploy.sh
   ```

The deploy script automatically pulls changes from GitHub, stops active containers, builds changed images, and spins them back up.

### Database Backups
Refer to [DEPLOYMENT.md](file:///d:/JivdaniApp/DEPLOYMENT.md) for full commands on backing up/restoring MongoDB data.
