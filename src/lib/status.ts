export const ENQUIRY_STATUS: Record<string, { label: string; badge: string }> = {
  new: { label: "New", badge: "badge-new" },
  in_progress: { label: "In progress", badge: "badge-prog" },
  replied: { label: "Replied", badge: "badge-ok" },
  converted: { label: "Converted to order", badge: "badge-rose" },
  closed: { label: "Closed", badge: "badge-draft" },
};
export const ORDER_STATUS: Record<string, { label: string; badge: string }> = {
  confirmed: { label: "Confirmed", badge: "badge-ok" },
  delivered: { label: "Delivered", badge: "badge-prog" },
  cancelled: { label: "Cancelled", badge: "badge-cancel" },
};
export const SOURCE_LABEL: Record<string, string> = { product: "Product page", multi: "Saved designs", custom: "Custom Jewellery page", general: "Website" };
