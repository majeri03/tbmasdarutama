export interface StoreSetting {
  id: string;
  name: string;
  tagline?: string | null;
  logoUrl?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  website?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  whatsapp?: string | null;
  taxNumber?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  bankHolder?: string | null;
  invoiceLayoutType: string;
  invoicePaperSize: string;
  invoiceShowHeader: boolean;
  invoiceShowLogo: boolean;
  invoiceShowCustomerInfo: boolean;
  invoiceShowPaymentInfo: boolean;
  invoiceShowSignature: boolean;
  invoiceShowFooter: boolean;
  invoiceFooterTerms?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LandingPageSetting {
  id: string;
  heroTitle: string;
  heroSubtitle: string;
  aboutUs?: string | null;
  whyChooseUs?: string | null;
  showFeaturedProducts: boolean;
  contactMapUrl?: string | null;
  heroImages?: HeroImage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface HeroImage {
  id: string;
  landingId: string;
  imageUrl: string;
  order: number;
  isActive: boolean;
  createdAt: Date;
}

export interface StoreSettingFormData {
  name: string;
  tagline?: string;
  logoUrl?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  whatsapp?: string;
  taxNumber?: string;
  bankName?: string;
  bankAccount?: string;
  bankHolder?: string;
  invoiceLayoutType?: string;
  invoicePaperSize?: string;
  invoiceShowHeader?: boolean;
  invoiceShowLogo?: boolean;
  invoiceShowCustomerInfo?: boolean;
  invoiceShowPaymentInfo?: boolean;
  invoiceShowSignature?: boolean;
  invoiceShowFooter?: boolean;
  invoiceFooterTerms?: string;
}