export const MAX_REPRESENTATIVE_ITEMS = 10;

export const canAddRepresentativeItem = (count: number) => count < MAX_REPRESENTATIVE_ITEMS;

export const getCustomerAttachmentType = (fileName: string) => {
  const name = String(fileName || "").toLowerCase();
  if (name.includes("سجل") || name.includes("commercial")) return "commercial_register";
  if (name.includes("عنوان") || name.includes("national")) return "national_address";
  return "customer_document";
};

export const hasRequiredCustomerAttachments = (types: string[]) => {
  const available = new Set(types);
  return available.has("commercial_register") && available.has("national_address");
};
