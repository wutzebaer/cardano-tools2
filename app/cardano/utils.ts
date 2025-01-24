export function formatAda(value?: number) {
  if (value == null) {
    return "";
  }

  const browserLocale = navigator.language || "en-US"; // Fallback zu "en-US"
  const formattedValue = new Intl.NumberFormat(browserLocale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(value / 1000000);

  return `${formattedValue}\xa0₳`;
}
