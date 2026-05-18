export interface Document {
  id: string;
  title: string;
  fileName: string;
  type?: string; // Document type: SPD, SBC, or Document
  uploadedAt: string;
  expirationDate?: string; // Optional expiration date
  client: {
    id: string;
    companyName: string;
  };
  category?: string;
  categorySuggested?: string;
  categoryConfidence?: number;
}

export type SortColumn = "title" | "client" | "uploadedAt" | "expirationDate";
export type SortDirection = "asc" | "desc";

export interface Client {
  id: string;
  companyName: string;
  status?: string;
}

