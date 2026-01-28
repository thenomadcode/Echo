import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface StickySaveButtonFormState {
	state: { canSubmit: boolean; isSubmitting: boolean };
	Subscribe: React.ComponentType<{
		children: (state: { canSubmit: boolean; isSubmitting: boolean }) => React.ReactNode;
	}>;
}

export interface StickySaveButtonProps {
	form: StickySaveButtonFormState;
}

export function StickySaveButton({ form }: StickySaveButtonProps) {
	const sentinelRef = useRef<HTMLDivElement>(null);
	const [isStuck, setIsStuck] = useState(false);

	useEffect(() => {
		const sentinel = sentinelRef.current;
		if (!sentinel) return;

		const observer = new IntersectionObserver(
			([entry]) => {
				setIsStuck(!entry?.isIntersecting);
			},
			{ threshold: 0 },
		);

		observer.observe(sentinel);
		return () => observer.disconnect();
	}, []);

	return (
		<>
			<div ref={sentinelRef} className="h-0" />
			<div
				className={cn(
					"-mx-4 sticky bottom-4 flex justify-end rounded-lg bg-background/80 p-4 backdrop-blur-sm transition-shadow",
					isStuck && "border shadow-lg",
				)}
			>
				<form.Subscribe>
					{(state) => (
						<Button
							type="submit"
							disabled={!state.canSubmit || state.isSubmitting}
							className="h-11"
						>
							{state.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							{state.isSubmitting ? "Saving..." : "Save Changes"}
						</Button>
					)}
				</form.Subscribe>
			</div>
		</>
	);
}
