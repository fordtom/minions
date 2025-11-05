import type {
	HTMLAttributes,
	RefObject,
	TdHTMLAttributes,
	ThHTMLAttributes,
} from "react";

import { cn } from "@/lib/utils";

const Table = ({
	className,
	ref,
	...props
}: HTMLAttributes<HTMLTableElement> & {
	ref?: RefObject<HTMLTableElement | null>;
}) => (
	<div className="relative w-full overflow-auto">
		<table
			className={cn("w-full caption-bottom text-sm", className)}
			ref={ref}
			{...props}
		/>
	</div>
);
Table.displayName = "Table";

const TableHeader = ({
	className,
	ref,
	...props
}: HTMLAttributes<HTMLTableSectionElement> & {
	ref?: RefObject<HTMLTableSectionElement | null>;
}) => (
	<thead className={cn("[&_tr]:border-b", className)} ref={ref} {...props} />
);
TableHeader.displayName = "TableHeader";

const TableBody = ({
	className,
	ref,
	...props
}: HTMLAttributes<HTMLTableSectionElement> & {
	ref?: RefObject<HTMLTableSectionElement | null>;
}) => (
	<tbody
		className={cn("[&_tr:last-child]:border-0", className)}
		ref={ref}
		{...props}
	/>
);
TableBody.displayName = "TableBody";

const TableFooter = ({
	className,
	ref,
	...props
}: HTMLAttributes<HTMLTableSectionElement> & {
	ref?: RefObject<HTMLTableSectionElement | null>;
}) => (
	<tfoot
		className={cn(
			"border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
			className
		)}
		ref={ref}
		{...props}
	/>
);
TableFooter.displayName = "TableFooter";

const TableRow = ({
	className,
	ref,
	...props
}: HTMLAttributes<HTMLTableRowElement> & {
	ref?: RefObject<HTMLTableRowElement | null>;
}) => (
	<tr
		className={cn(
			"border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
			className
		)}
		ref={ref}
		{...props}
	/>
);
TableRow.displayName = "TableRow";

const TableHead = ({
	className,
	ref,
	...props
}: ThHTMLAttributes<HTMLTableCellElement> & {
	ref?: RefObject<HTMLTableCellElement | null>;
}) => (
	<th
		className={cn(
			"h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
			className
		)}
		ref={ref}
		{...props}
	/>
);
TableHead.displayName = "TableHead";

const TableCell = ({
	className,
	ref,
	...props
}: TdHTMLAttributes<HTMLTableCellElement> & {
	ref?: RefObject<HTMLTableCellElement | null>;
}) => (
	<td
		className={cn(
			"p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
			className
		)}
		ref={ref}
		{...props}
	/>
);
TableCell.displayName = "TableCell";

const TableCaption = ({
	className,
	ref,
	...props
}: HTMLAttributes<HTMLTableCaptionElement> & {
	ref?: RefObject<HTMLTableCaptionElement | null>;
}) => (
	<caption
		className={cn("mt-4 text-muted-foreground text-sm", className)}
		ref={ref}
		{...props}
	/>
);
TableCaption.displayName = "TableCaption";

export {
	Table,
	TableHeader,
	TableBody,
	TableFooter,
	TableHead,
	TableRow,
	TableCell,
	TableCaption,
};
