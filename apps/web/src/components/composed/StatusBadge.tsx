import { Badge } from "@/components/ui/badge";

type OrderStatus =
  | "draft"
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "delivered"
  | "cancelled";

type ConversationStatus = "active" | "escalated" | "closed";

interface StatusBadgeProps {
  status: string;
  type: "order" | "conversation";
  assignedTo?: string;
}

const ORDER_STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "success" | "warning" | "info" }
> = {
  draft: { label: "Draft", variant: "secondary" },
  pending: { label: "Pending", variant: "secondary" },
  confirmed: { label: "Confirmed", variant: "default" },
  preparing: { label: "Preparing", variant: "info" },
  ready: { label: "Ready", variant: "warning" },
  delivered: { label: "Delivered", variant: "success" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

const CONVERSATION_STATUS_CONFIG: Record<
  ConversationStatus,
  { label: string; variant: "default" | "secondary" | "success" | "warning" }
> = {
  active: { label: "AI Handling", variant: "default" },
  escalated: { label: "Escalated", variant: "warning" },
  closed: { label: "Closed", variant: "success" },
};

export function StatusBadge({ status, type, assignedTo }: StatusBadgeProps) {
  if (type === "order") {
    const config = ORDER_STATUS_CONFIG[status as OrderStatus];
    if (!config) {
      return <Badge variant="secondary">{status}</Badge>;
    }
    return <Badge variant={config.variant}>{config.label}</Badge>;
  }

  const conversationStatus = status as ConversationStatus;

  if (conversationStatus === "active" && assignedTo) {
    return <Badge variant="default">Human Active</Badge>;
  }

  const config = CONVERSATION_STATUS_CONFIG[conversationStatus];
  if (!config) {
    return <Badge variant="secondary">{status}</Badge>;
  }

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
