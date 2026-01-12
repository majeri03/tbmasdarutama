import { format } from "date-fns";
import { id } from "date-fns/locale";

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
};

export const formatDate = (date: Date | string): string => {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return format(dateObj, "dd MMMM yyyy", { locale: id });
};

export const formatDateTime = (date: Date | string): string => {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return format(dateObj, "dd MMM yyyy HH:mm", { locale: id });
};

export const getCurrentDate = (): string => {
  return format(new Date(), "dd MMMM yyyy", { locale: id });
};

export const getCurrentDateTime = (): string => {
  return format(new Date(), "dd MMMM yyyy, HH:mm 'WIB'", { locale: id });
};