 FINAL ROADMAP - SETTINGS MODULE
📋 REVISI REQUIREMENT
✅ SMTP: Sudah ready (Google)
✅ Landing Page: Root / (homepage)
✅ Logo: Max 1MB, PNG/JPG/SVG
✅ Hero Images: Tanpa caption/CTA, pure gallery
✅ Authorization: SUPER_ADMIN only
✅ Design: Glass Morphism consistency
✅ Background: Abstract bahan bangunan pattern
🏗️ PHASE 1: DATABASE FOUNDATION
1.1 Prisma Schema Update
Command:

🗂️ PHASE 2: FILE STRUCTURE
Daftar File Baru:
🎨 PHASE 3: DESIGN SYSTEM
3.1 Glass Morphism Components (Sudah ada di globals.css)
.glass-card → Container utama
.glass-input → Form inputs
.btn-primary → Primary action buttons
.btn-secondary → Secondary buttons
.modal-overlay → Modal dialogs
3.2 Background Abstract Pattern
Tambahkan di globals.css:

3.3 Tab Navigation Style
Tambahkan di globals.css:

🔧 PHASE 4: IMPLEMENTATION FLOW
Step 1: Database Migration ⏱️ 5 min
Update schema.prisma
Run migration
Verify di Prisma Studio
Step 2: TypeScript Types ⏱️ 10 min
types/settings.ts
Step 3: Validation Schemas ⏱️ 15 min
store-setting.schema.ts
landing-page.schema.ts
password-reset.schema.ts
Step 4: Server Actions ⏱️ 45 min
store-setting.actions.ts
landing-page.actions.ts
password-reset.actions.ts
email.ts
Step 5: UI Components ⏱️ 90 min
Settings main page (tabs)
Store Settings Tab
Password Settings Tab
Landing Page Tab
Reset Password page
Step 6: Middleware Protection ⏱️ 5 min
Update middleware.ts:

⚠️ VALIDATION & ERROR HANDLING
Critical Checks:
✅ Logo upload: Max 1MB, image only
✅ Hero images: Max 10, auto-order
✅ Email validation: Real SMTP check
✅ Password reset token: 1 hour expiry
✅ SUPER_ADMIN only: Middleware + action-level
✅ Form validation: Zod schemas
✅ Toast notifications: Success/error feedback
Error Prevention:
Optimistic UI updates
Loading states pada semua buttons
Image preview sebelum upload
Confirm dialogs untuk delete actions
📊 ESTIMATED TIME
Phase	Task	Time
1	Database Migration	5 min
2	Types & Schemas	25 min
3	Server Actions	45 min
4	Email Setup	15 min
5	Store Settings UI	60 min
6	Password Reset UI	30 min
7	Landing Page UI	60 min
8	Testing & Debug	30 min
TOTAL		~4.5 hours
🚀 EXECUTION ORDER
NOW → STORE SETTINGS (Phase 1)
✅ Database schema
✅ TypeScript types
✅ Validation schemas
✅ Server actions
✅ UI components
NEXT → PASSWORD RESET (Phase 2)
Email utility
Reset actions
UI pages
LAST → LANDING PAGE (Phase 3)
Landing actions
Hero image manager
Frontend landing page
📝 NOTES
Glass Morphism: Semua card/form menggunakan .glass-card class
Background Pattern: Abstrak bangunan dengan opacity rendah
Full Code: Setiap file diberikan lengkap di awal
Error Guide: Jika ada error, hanya lokasi file yang ditunjuk
Logo Display: Di invoice, receipt, dan landing page
Responsive: Mobile-first approach
Image Optimization: Auto-compress sebelum upload
SEO Ready: Landing page dengan proper meta tags
✅ READY TO START?
Kita mulai dari PHASE 1: STORE SETTINGS

Saya akan berikan:

✅ Database schema lengkap
✅ TypeScript types
✅ Zod validation
✅ Server actions
✅ UI components (full code)

src/
├── app/
│   ├── dashboard/
│   │   └── settings/
│   │       ├── page.tsx                          # ✅ Main container dengan tabs
│   │       └── _components/
│   │           ├── StoreSettingsTab.tsx          # ✅ Tab 1: CRUD Info Toko
│   │           ├── PasswordSettingsTab.tsx       # ✅ Tab 2: Change Password
│   │           └── LandingPageTab.tsx            # ✅ Tab 3: Landing Page Setup
│   │               ├── HeroImageManager.tsx      # ✅ Manage max 10 hero images
│   │               └── GeneralLandingForm.tsx    # ✅ Hero title, about, etc
│   │
│   ├── reset-password/
│   │   └── page.tsx                              # ✅ Public page untuk reset password
│   │
│   └── api/
│       └── settings/
│           └── request-reset/
│               └── route.ts                      # ✅ API endpoint kirim email
│
├── lib/
│   ├── actions/
│   │   ├── store-setting.actions.ts              # ✅ CRUD store settings
│   │   ├── landing-page.actions.ts               # ✅ CRUD landing page
│   │   └── password-reset.actions.ts             # ✅ Request & reset password
│   │
│   ├── validations/
│   │   ├── store-setting.schema.ts               # ✅ Zod validation
│   │   ├── landing-page.schema.ts                # ✅ Zod validation
│   │   └── password-reset.schema.ts              # ✅ Zod validation
│   │
│   └── utils/
│       └── email.ts                              # ✅ Nodemailer SMTP setup
│
└── types/
    └── settings.ts                               # ✅ TypeScript interfaces

**TOTAL: 16 files**


landing page
src/
├── app/
│   ├── (public)/                                    # 🆕 Route group untuk public pages
│   │   ├── layout.tsx                               # 🆕 Layout tanpa sidebar
│   │   └── page.tsx                                 # 🆕 Landing page (root /)
│   │
│   └── _components/                                 # 🆕 Shared landing components
│       ├── LandingHero.tsx                          # 🆕 Hero section dengan carousel
│       ├── LandingAbout.tsx                         # 🆕 About section
│       ├── LandingFeatures.tsx                      # 🆕 Why choose us section
│       ├── LandingProducts.tsx                      # 🆕 Featured products grid
│       ├── LandingContact.tsx                       # 🆕 Contact + maps
│       ├── LandingNavbar.tsx                        # 🆕 Public navbar
│       └── LandingFooter.tsx                        # 🆕 Footer
│
└── lib/
    └── actions/
        └── landing-public.actions.ts                # 🆕 Get public landing data

**TOTAL: 9 files baru**