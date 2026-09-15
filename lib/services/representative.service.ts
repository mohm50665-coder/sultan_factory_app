import { trpcCall } from "./api.service";

export type RepresentativeAttachmentInput = {
  type: string;
  name: string;
  url: string;
  mimeType?: string;
  expiresAt?: string;
};

export type RepresentativeItemInput = {
  productName: string;
  size: string;
  color: string;
  quantity: number;
  quantityUnit: "dozen" | "pair";
  productType?: string;
  yarnRatios?: Record<string, number>;
};

export type CustomerInput = {
  name: string;
  commercialRegister: string;
  taxNumber?: string;
  isTaxRegistered: boolean;
  municipalLicense?: string;
  nationalAddress: string;
  city: string;
  district: string;
  street: string;
  email: string;
  ownerName: string;
  ownerPhone: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  latitude: number;
  longitude: number;
  attachments: RepresentativeAttachmentInput[];
};

export type RepresentativeTransactionInput = {
  transactionType: "order" | "visit" | "return" | "custom" | "sample";
  customerId: number;
  orderDate: string;
  deliveryDate?: string;
  paymentMethod?: "cash" | "transfer" | "credit";
  paymentAmount?: number;
  receiptNumber?: string;
  receiptDate?: string;
  creditDays?: 30 | 60 | 90;
  visitReport?: string;
  returnReason?: string;
  items: RepresentativeItemInput[];
  attachments: RepresentativeAttachmentInput[];
};

export const representativeService = {
  customers: {
    list: (search = "") => trpcCall("representative.customers.list", { search }, "query"),
    getById: (id: number) => trpcCall("representative.customers.getById", { id }, "query"),
    create: (data: CustomerInput) => trpcCall("representative.customers.create", data),
    update: (id: number, data: CustomerInput) => trpcCall("representative.customers.update", { id, ...data }),
  },
  transactions: {
    list: (filters?: Record<string, unknown>) => trpcCall("representative.transactions.list", filters || {}, "query"),
    getById: (id: number) => trpcCall("representative.transactions.getById", { id }, "query"),
    createDraft: (data: RepresentativeTransactionInput) => trpcCall("representative.transactions.createDraft", data),
    updateDraft: (id: number, data: RepresentativeTransactionInput) => trpcCall("representative.transactions.updateDraft", { id, ...data }),
    sign: (data: { id: number; declarationType: "customer_order" | "representative_order" | "representative_receipt" | "representative_sample_receipt"; declarationText: string; declarerName: string; declarerRole: string; signatureData: string }) => trpcCall("representative.transactions.sign", data),
    submit: (id: number) => trpcCall("representative.transactions.submit", { id }),
    transition: (data: { id: number; action: string; notes?: string; attachments?: RepresentativeAttachmentInput[]; invoiceNumber?: string; correctiveAction?: { action: string; evidence: RepresentativeAttachmentInput[] } }) => trpcCall("representative.transactions.transition", data),
    softDelete: (id: number, reason: string) => trpcCall("representative.transactions.softDelete", { id, reason }),
  },
  collections: {
    list: (filters?: Record<string, unknown>) => trpcCall("representative.collections.list", filters || {}, "query"),
    create: (data: Record<string, unknown>) => trpcCall("representative.collections.create", data),
  },
  approvals: () => trpcCall("representative.approvals", undefined, "query"),
  performance: {
    summary: (filters?: Record<string, unknown>) => trpcCall("representative.performance.summary", filters || {}, "query"),
    updateWeights: (weights: Array<{ criterionKey: string; criterionName: string; weight: number; targetValue: number }>) => trpcCall("representative.performance.updateWeights", weights),
  },
  scanOverdue: () => trpcCall("representative.scanOverdue", {}),
};
