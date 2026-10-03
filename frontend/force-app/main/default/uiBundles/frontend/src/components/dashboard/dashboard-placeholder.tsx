import { Card, CardContent, CardHeader } from "../ui/card";

export interface DashboardPlaceholderProps {
	title: string;
	/** Short line describing what will live here. Rendered as muted helper text. */
	description?: string;
	/** Number of static placeholder rows. */
	rows?: number;
	className?: string;
}

/**
 * A static wireframe block for a dashboard card that has no data behind it yet.
 *
 * WHY THIS IS NOT `Skeleton`
 *   `components/ui/skeleton.tsx` hardcodes `animate-pulse`. That is right for a
 *   request in flight and wrong for a permanent placeholder: a pulsing block
 *   reads as "loading", so the dashboard would appear permanently busy and imply
 *   data is on its way. Nothing here animates, because nothing is coming.
 *
 * The bars are decorative and hidden from assistive tech — the card's title and
 * description already carry the meaning, and announcing empty grey boxes adds
 * nothing.
 */
export function DashboardPlaceholder({
	title,
	description,
	rows = 3,
	className,
}: DashboardPlaceholderProps) {
	const barWidths = ["w-3/4", "w-1/2", "w-2/3"];

	return (
		<Card className={className}>
			<CardHeader>
				<h2 className="text-base font-semibold text-card-foreground">{title}</h2>
				{description ? (
					<p className="text-sm text-muted-foreground">{description}</p>
				) : null}
			</CardHeader>
			<CardContent>
				<div aria-hidden="true" className="space-y-3">
					{Array.from({ length: rows }, (_, index) => (
						<div
							key={index}
							className={`h-3 rounded-full bg-muted ${barWidths[index % barWidths.length]}`}
						/>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

export default DashboardPlaceholder;