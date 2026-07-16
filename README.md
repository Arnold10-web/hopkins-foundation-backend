# Hopkins Foundation - Backend

Backend API for the Hopkins Foundation NGO Website.

## 🚀 Quick Start

### Development
```bash
npm install
cp .env.example .env
# Edit .env with your credentials
npx prisma generate
npx prisma migrate dev
npm run dev
```

### Production (Railway)
See main DEPLOYMENT_GUIDE.md in root directory

## 📦 Tech Stack
- Node.js + Express + TypeScript
- Prisma ORM + PostgreSQL
- JWT Authentication
- Stripe Payments
- SendGrid Email
- Socket.IO WebSockets
- Multer File Uploads

## 🔑 Environment Variables
See `.env.example` for all required variables.

## 🗄️ Database
PostgreSQL with Prisma ORM
- Migrations in `prisma/migrations/`
- Schema in `prisma/schema.prisma`

## 📁 Project Structure
```
backend/
├── src/
│   ├── app.ts              # Main application entry
│   ├── controllers/        # Route handlers
│   ├── middleware/         # Auth, validation
│   ├── routes/             # API routes
│   ├── services/           # Business logic
│   └── utils/              # Helper functions
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── migrations/         # Database migrations
├── uploads/                # File storage (ephemeral on Railway)
└── tests/                  # Test files
```

## 🔐 API Authentication
Most endpoints require JWT token:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

## 📡 API Endpoints

### Public Endpoints
- `GET /api/health` - Health check
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/stories/public` - Public stories
- `GET /api/programs` - All programs
- `POST /api/contact` - Contact form
- `POST /api/newsletter/subscribe` - Newsletter signup

### Protected Endpoints (Require Auth)
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update profile
- `GET /api/stories/exclusive` - Member-only stories
- `GET /api/members/dashboard` - Member dashboard
- `POST /api/donations/create-intent` - Create donation
- `POST /api/upload/profile` - Upload profile image

### Admin Endpoints (Require Admin Role)
- `POST /api/stories` - Create story
- `PUT /api/stories/:id` - Update story
- `DELETE /api/stories/:id` - Delete story
- `POST /api/programs` - Create program
- `PUT /api/programs/:id` - Update program
- `DELETE /api/programs/:id` - Delete program
- `GET /api/contact` - Get all messages
- `GET /api/newsletter/subscribers` - Get subscribers

## 🧪 Testing
```bash
npm test
npm run test:watch
```

## 🔧 Database Commands
```bash
# Generate Prisma Client
npx prisma generate

# Create migration
npx prisma migrate dev --name migration_name

# Deploy migrations (production)
npx prisma migrate deploy

# Open Prisma Studio
npx prisma studio

# Reset database (dev only)
npx prisma migrate reset
```

## 📊 Monitoring
- Railway provides logs and metrics
- Health check: `GET /api/health`
- Database stats available in Railway dashboard

## 🚨 Important Notes

### File Uploads
⚠️ **Railway's file system is ephemeral!**
- Uploaded files are stored temporarily
- Files are LOST on redeployment
- **Recommended:** Migrate to Cloudinary or AWS S3 for production

### Database Migrations
Always run migrations on deployment:
```bash
npx prisma migrate deploy
```

### Environment Variables
Never commit `.env` to version control.
Use Railway dashboard to set production variables.

## 🆘 Troubleshooting

### Database Connection Error
1. Check `DATABASE_URL` is set correctly
2. Verify PostgreSQL is running (Railway provides this automatically)
3. Run `npx prisma generate`

### Prisma Client Error
```bash
npx prisma generate
```

### Migration Failed
```bash
npx prisma migrate resolve --applied "migration_name"
npx prisma migrate deploy
```

## 📚 Documentation
- [Express.js](https://expressjs.com/)
- [Prisma](https://www.prisma.io/docs)
- [Stripe API](https://stripe.com/docs/api)
- [SendGrid](https://docs.sendgrid.com/)

## 📝 License
MIT

## 🤝 Support
For deployment issues, see DEPLOYMENT_GUIDE.md in project root.
