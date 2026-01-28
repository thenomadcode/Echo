import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
	status: "active" | "escalated" | "closed";
	assignedTo?: string;
}

export function StatusBadge({ status, assignedTo }: StatusBadgeProps) {
	if (status === "closed") {
		return <Badge variant="secondary">Closed</Badge>;
	}

	if (status === "escalated") {
		return <Badge variant="destructive">Escalated</Badge>;
	}

	if (assignedTo) {
		return <Badge variant="default">Human Active</Badge>;
	}

	return <Badge variant="success">AI Handling</Badge>;
}
