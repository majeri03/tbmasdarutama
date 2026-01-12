import { z } from "zod";

export const landingPageSchema = z.object({
  heroTitle: z.string().min(3, "Judul hero minimal 3 karakter"),
  heroSubtitle: z.string().min(3, "Subjudul hero minimal 3 karakter"),
  aboutUs: z.string().optional(),
  whyChooseUs: z.string().optional(),
  showFeaturedProducts: z.boolean().default(true),
  contactMapUrl: z.string().url("URL map tidak valid").optional().or(z.literal("")),
});

export const heroImageSchema = z.object({
  imageUrl: z.string().url("URL gambar tidak valid"),
  order: z.number().int().min(0).max(9),
});

export type LandingPageFormValues = z.infer<typeof landingPageSchema>;
export type HeroImageFormValues = z.infer<typeof heroImageSchema>;