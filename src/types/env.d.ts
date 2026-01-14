declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DATABASE_URL: string;
      NEXTAUTH_URL: string;
      NEXTAUTH_SECRET: string;
      NODE_ENV: "development" | "production";
      
      // Data Base Cloudflare R2
      CLOUDFLARE_WORKER_URL: string;
      CLOUDFLARE_R2_PUBLIC_URL: string;
    }
  }
}

export {};