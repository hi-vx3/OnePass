# OnePass Backend - Technical Guidelines

## 1. Overview
OnePass هو مشروع API متقدم مع نظام تسجيل دخول متقدم، بريد وهمي داخلي، وواجهة مطورين.  
الهدف: أمان صارم، أداء عالي، توسعة سهلة، بدون استخدام Docker أو Kubernetes.  

---

## 2. Programming Languages and Versions
- **Node.js**: 24.x (LTS)  
- **TypeScript**: 5.9  
- **Rust**: 1.89 (stable) - مكتبات أمنية وعملية التشفير  
- **Ada / SPARK**: GNAT Pro 25 ( لوظائف حرجة حساسة)  
- **SQL**: MySQL 8.0.x  
- **Redis**: 7.8+  

> جميع اللغات يجب تثبيتها بالإصدارات المحددة لتجنب مشاكل التوافق.

---

## 3. Frameworks and Libraries
### Backend
- **Express** 5.1.x  
- **Prisma ORM** 6.15.x (MySQL provider)  
- **Redis Client**: ioredis 5.x  
- **Argon2id**: password hashing  
- **AES-256-GCM**: encryption sensitive data  
- **ECC Curve25519 / RSA-4096**: asymmetric crypto for signing  
- **JWT**: JWE + JWS، access token و refresh token  
- **TOTP**: RFC6238 2FA verification  
- **Input Validation**: Zod 3.x / Joi 17.x  
- **Logging**: pino 8.x (structured JSON logs)  
- **Unit Testing**: Jest 29.x, Supertest 7.x  
- **Security Auditing**: Snyk / npm audit  

### Frontend (React + Tailwind)
- **React** 18.x  
- **Tailwind CSS** 3.x  
- **React Router** 6.x  
- **Axios** 1.x (API calls)  
- **Testing Library**: React Testing Library 14.x  

---

## 4. Project Structure
```

backend/
├─ src/
│  ├─ config/          # Environment variables, Vault clients, TLS
│  ├─ routes/          # Express routers
│  ├─ controllers/     # Business logic
│  ├─ services/        # Auth, mail-forwarder, crypto, api-key
│  ├─ security/        # Rust/Ada bindings, HSM integration
│  ├─ models/          # Prisma schema
│  ├─ jobs/            # Workers (BullMQ)
│  ├─ middleware/
│  ├─ utils/
│  └─ app.ts
├─ prisma/
│  └─ schema.prisma
├─ scripts/
├─ systemd/            # systemd service units
└─ README.md

````

---

## 5. Coding Standards - Military Approach
- **Strict TypeScript**: `strict: true`, ESLint + Prettier mandatory.  
- **No inline SQL**: جميع الاستعلامات عبر Prisma مع prepared statements.  
- **Unit & Integration Tests**: 80%+ coverage للكود الحساس.  
- **Branching**: main, develop, feature/*  
- **Code Reviews**: إلزامي قبل الدمج.  
- **Error Handling**: جميع الأخطاء توثّق في logs مفصلة + response موحد للمستخدم.  
- **Secrets Management**: Vault / HSM، لا تخزن أي secret في ملفات .env على الخادم.  
- **Logging & Monitoring**:  
  - structured JSON logs  
  - Prometheus metrics  
  - OpenTelemetry tracing  
  - Sentry for error tracking  

---

## 6. Security and Encryption
- **Passwords**: Argon2id (time=4, memory=64-256MB, parallelism=2)  
- **Data at Rest**: AES-256-GCM، master_key في Vault/HSM  
- **Asymmetric Crypto**: ECC Curve25519 or RSA-4096  
- **JWT**:  
  - Access token 15 دقيقة  
  - Refresh token 7 أيام، HttpOnly Secure cookie  
- **2FA**: TOTP RFC6238 (30-300 ثانية)  
- **Input Validation**: Zod / Joi لجميع endpoints  
- **Rate Limiting & Brute Force Protection**: per IP + per API Key  
- **Email Verification / Forwarding**: Postfix + Dovecot + DKIM/SPF/DMARC + postsrsd  

---

## 7. REST API Guidelines
- All responses: JSON `{ success: boolean, status: number, data?: {}, error?: {} }`  
- Example Endpoints:
  - `POST /api/auth/register`  
  - `POST /api/auth/request-totp`  
  - `POST /api/auth/verify-totp`  
  - `POST /api/auth/token`  
  - `GET /api/user/api-keys`  
  - `POST /api/user/api-keys`  
  - `PATCH /api/user/api-keys/:id/revoke`  
  - `GET /api/logs` (admin)  
  - `GET /api/status`  

- OpenAPI spec mandatory for all endpoints.  

---

## 8. Deployment (Systemd-based)
- Each service runs independently under systemd.  
- Example: `/etc/systemd/system/OnePass-api.service`  
```ini
[Unit]
Description=OnePass API
After=network.target

[Service]
User=OnePass
Group=OnePass
WorkingDirectory=/opt/OnePass
EnvironmentFile=/etc/OnePass.env
ExecStart=/usr/bin/node ./dist/app.js
Restart=on-failure
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
````

* Reload & restart service after deploy: `systemctl daemon-reload && systemctl restart OnePass-api.service`

---

## 9. Development Workflow

1. Clone repo → install dependencies.
2. Configure env vars via `/etc/OnePass.env` (600 permission).
3. Run Prisma migrations: `prisma migrate dev`.
4. Run local server: `ts-node-dev src/app.ts`.
5. Write unit tests & integration tests.
6. Commit → push → code review → merge → deploy.

---

## 10. Notes

* **No Docker / Containers**: All services run on host system.
* **High Security**: All crypto-related code isolated in Rust/Ada modules.
* **Version Control**: Lock package versions, do not auto-update without testing.
* **Backups**: MySQL daily backup, Redis snapshot, encrypted offsite storage.

---

> هذا الملف يوضح كل شيء لمطوّر باك إند لتطبيق OnePass وفق معايير صارمة، أمان كامل، ونسق برمجي منضبط.
