export interface Sql {
  all(query: string, params?: unknown[]): Promise<any[]>;
  run(query: string, params?: unknown[]): Promise<{ changes: number }>;
  batch(statements: { sql: string; params: unknown[] }[]): Promise<void>;
}
export type Product = {
  id: string;
  title: string;
  category: string;
  brand: string | null;
  price: number | null;
  maxPrice: number | null;
  image: string | null;
  count: number;
  specs?: { key: string; value: unknown }[];
  offers?: any[];
};
export type SearchContext = {
  category?: string;
  position?: [number, number] | null;
  excludedShopIds?: string[];
  query: string;
  budget: number | null;
  brand: string;
  place: string;
  radius: number;
  installment: boolean;
  onlyOpen: boolean;
  sort: "recommended" | "price";
  selectedId: string | null;
  compareIds: string[];
};
export type Action =
  | { type: "results"; products: Product[] }
  | { type: "sellers"; offers: any[] }
  | { type: "markets"; areas: any[]; catalogue: Product[] }
  | { type: "inquiry"; inquiry: any }
  | { type: "search"; filters: Partial<SearchContext> }
  | { type: "select"; product: Product }
  | { type: "compare"; products: Product[] };
export type ToolTrace = {
  name: string;
  status: "ok" | "error";
  durationMs: number;
};
export type ChatReply = {
  threadId: string;
  requestId: string;
  text: string;
  provider: "llm" | "local";
  model?: string;
  actions: Action[];
  tools: ToolTrace[];
};
export type StoredSession = {
  history: any[][];
  context?: SearchContext;
  pending?: {
    requestId: string;
    input: any[];
    actions: Action[];
    tools: ToolTrace[];
    rounds: number;
    context: SearchContext;
    stage: "model" | "tools";
  };
  lastReply?: ChatReply;
};
export type Runtime = {
  LLM_PROVIDER?: string;
  LLM_API_KEY?: string;
  LLM_BASE_URL?: string;
  LLM_MODEL?: string;
  LLM_API_STYLE?: string;
  NINEROUTER_KEY?: string;
  NINEROUTER_URL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  OPENAI_BASE_URL?: string;
  CATALOG_IMPORT_ENABLED?: string;
};
