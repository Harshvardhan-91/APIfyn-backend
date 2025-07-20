export interface RazorpayOrder {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  status: string;
  attempts: number;
  created_at: number;
}

export interface RazorpaySubscription {
  id: string;
  entity: string;
  plan_id: string;
  customer_id: string;
  status: string;
  current_start: number;
  current_end: number;
  ended_at?: number;
  quantity: number;
  notes: Record<string, string>;
  charge_at: number;
  start_at: number;
  end_at?: number;
  auth_attempts: number;
  total_count: number;
  paid_count: number;
  customer_notify: boolean;
  created_at: number;
  expire_by?: number;
  short_url: string;
  has_scheduled_changes: boolean;
  change_scheduled_at?: number;
  source: string;
  payment_method?: string;
  offer_id?: string;
  remaining_count: number;
}

export interface RazorpayPayment {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  status: string;
  order_id: string;
  invoice_id?: string;
  international: boolean;
  method: string;
  amount_refunded: number;
  refund_status?: string;
  captured: boolean;
  description?: string;
  card_id?: string;
  bank?: string;
  wallet?: string;
  vpa?: string;
  email: string;
  contact: string;
  notes: Record<string, string>;
  fee: number;
  tax: number;
  error_code?: string;
  error_description?: string;
  created_at: number;
}

export interface RazorpayWebhookData {
  entity: string;
  account_id: string;
  event: string;
  contains: string[];
  payload: {
    payment: RazorpayPayment;
    subscription?: RazorpaySubscription;
    order?: RazorpayOrder;
  };
  created_at: number;
}
