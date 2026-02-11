import { Warning, CircleNotch, DotsThreeVertical, Package, Plus, MagnifyingGlass, Trash } from "@phosphor-icons/react";
import { Button } from "./ui/button";
import Link from "next/link";
import { Input } from "./ui/input";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import {
    Card, 
    CardContent,
    CardDescription,
    CardTitle,
} from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type EntityHeaderProps = {
    title: string;
    description?: string;
    newButtonLabel?: string;
    disabled?: boolean;
    isCreating?: boolean;
} & (
    | { onNew: () => void; newButtonHref?: never }
    | { newButtonHref: string; onNew?: never }
    | { onNew?: never; newButtonHref?: never }
);

export const EntityHeader = ({
    title,
    description,
    onNew,
    newButtonHref,
    newButtonLabel,
    disabled,
    isCreating,
}: EntityHeaderProps) => {
    return (
        <div className="flex flex-row items-center justify-between gap-x-4">
            <div className="flex flex-col">
                <h1 className="text-lg md:text-xl font-semibold">{title}</h1>
                {description && (
                    <p className="text-xs md:text-sm text-muted-foreground">
                        {description}
                    </p>
                )}
            </div>
            {onNew && !newButtonHref && (
                <Button
                    disabled={isCreating || disabled}
                    size="sm"
                    onClick={onNew}
                >
                    <Plus className="size-4" />
                    {newButtonLabel}
                </Button>
            )}
            {newButtonHref && !onNew && (
                <Button
                    size="sm"
                    asChild
                >
                    <Link href={newButtonHref} prefetch>
                        <Plus className="size-4" />
                        {newButtonLabel}
                    </Link>
                    
                </Button>
            )}
        </div>
    );
};

type EntityContainerProps = {
    children: React.ReactNode;
    header?: React.ReactNode;
    search?: React.ReactNode;
    pagination?: React.ReactNode;
};

export const EntityContainer = ({
    children,
    header,
    search,
    pagination,
}: EntityContainerProps) => {
    return (
        <div className="p-4 md:px-10 md:py-6 h-full w-full">
            <div className="mx-auto max-w-6xl w-full flex flex-col gap-y-8 h-full">
                {header}
                <div className="flex flex-col gap-y-4 h-full">
                    {search}
                    {children}
                </div>
                {pagination}
            </div>
        </div>
    )
};

interface EntitySearchProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
};

export const EntitySearch = ({
    value, 
    onChange,
    placeholder = "Search",
}: EntitySearchProps) => {
    return (
        <div className="relative ml-auto">
            <MagnifyingGlass className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
            <Input
                className="max-w-[200px] bg-background shadow-none border-border pl-8"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
        </div>
    );
};


interface EntityPaginationProps {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void; 
    disabled?: boolean;
};

export const EntityPagination = ({
    page,
    totalPages,
    onPageChange,
    disabled,
}: EntityPaginationProps) => {
    return (
        <div className="flex items-center justify-between gap-x-2 w-full">
            <div className="flex-1 text-sm text-muted-foreground">
                Page {page} of {totalPages || 1} 
            </div>
            <div className="flex items-center justify-end space-x-2 py-4">
                <Button
                    disabled={page === 1 || disabled}
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(Math.max(1, page - 1))}
                >
                    Previous
                </Button>
                <Button
                    disabled={page === totalPages || totalPages === 0 || disabled}
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                >
                    Next
                </Button>
            </div>
        </div>
    )
};

interface StateViewProps {
    message?: string;
};

export const LoadingView = ({
    message,
}: StateViewProps) => {
    return (
        <div className="flex justify-center items-center h-full flex-1 flex-col gap-y-4">
            <CircleNotch className="size-6 animate-spin text-primary" />
            {!!message && (
                <p className="text-sm text-muted-foreground">
                    {message}
                </p>
            )}
        </div>
    );
};

export const ErrorView = ({
    message,
}: StateViewProps) => {
    return (
        <div className="flex justify-center items-center h-full flex-1 flex-col gap-y-4">
            <Warning className="size-6 text-primary" />
            {!!message && (
                <p className="text-sm text-muted-foreground">
                    {message}
                </p>
            )}
        </div>
    );
};

interface EmptyViewProps extends StateViewProps {
    onNew?: () => void;
    buttonLabel?: string;
    title?: string;
};

export const EmptyView = ({
    message,
    onNew,
    buttonLabel = "Add item",
    title = "No items",
}: EmptyViewProps) => {
    return (
        <Empty className="border border-dashed bg-white">
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <Package />
                </EmptyMedia>
            </EmptyHeader>
            <EmptyTitle>
                {title}
            </EmptyTitle>
            {!!message && (
            <EmptyDescription>
                {message}
            </EmptyDescription>
            )}
            {!!onNew && (
                <EmptyContent>
                    <Button onClick={onNew}>
                        {buttonLabel}
                    </Button>
                </EmptyContent>
            )}
        </Empty>
    )
};

interface EntityListProps<T> {
    items: T[];
    renderItem: (item: T, index: number) => React.ReactNode;
    getKey?: (item: T, index: number) => string | number;
    emptyView?: React.ReactNode;
    className?: string;
    variant?: "list" | "grid";
};

export function EntityList<T> ({
    items,
    renderItem,
    getKey,
    emptyView,
    className,
    variant = "list",
}: EntityListProps<T>) {
    if (items.length === 0 && emptyView) {
        return (
            <div className="flex-1 flex justify-center items-center">
                <div className="max-w-sm mx-auto">
                    {emptyView}
                </div>
            </div>
        );
    };

    return (
        <div className={cn(
            variant === "grid"
                ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                : "flex flex-col gap-y-4",
            className,
        )}>
            {items.map((item, index) => (
                <div key ={getKey ? getKey(item, index) : index}>
                    {renderItem(item, index)}
                </div>
            ))}

        </div>
    );
};

interface EntityGridItemProps {
    href: string;
    title: string;
    description?: string;
    icon?: React.ReactNode;
    color?: string;
    status?: "active" | "draft" | "archived";
    stats?: { label: string; value: string | number }[];
    onRemove?: () => void | Promise<void>;
    isRemoving?: boolean;
    className?: string;
};

export const EntityGridItem = ({
    href,
    title,
    description,
    icon,
    color = "#E6C147",
    status,
    stats,
    onRemove,
    isRemoving,
    className,
}: EntityGridItemProps) => {
    const handleRemove = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (isRemoving) {
            return;
        }

        if (onRemove) {
            await onRemove();
        }
    }

    return (
        <Link href={href} prefetch>
            <Card
                className={cn(
                    "group relative overflow-hidden transition-all duration-200",
                    "hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5",
                    isRemoving && "opacity-50 cursor-not-allowed pointer-events-none",
                    className
                )}
            >
                {/* Color accent bar */}
                <div
                    className="h-1.5 w-full"
                    style={{ backgroundColor: color }}
                />
                <CardContent className="p-5">
                    {/* Header with icon and menu */}
                    <div className="flex items-start justify-between mb-4">
                        <div
                            className="size-12 rounded-xl flex items-center justify-center text-white text-xl shadow-sm"
                            style={{ backgroundColor: color }}
                        >
                            {icon}
                        </div>
                        {onRemove && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="size-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <DotsThreeVertical className="size-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="end"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <DropdownMenuItem onClick={handleRemove} className="text-destructive">
                                        <Trash className="size-4" />
                                        Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>

                    {/* Title and status */}
                    <div className="mb-2">
                        <div className="flex items-center gap-2">
                            <CardTitle className="text-base font-semibold line-clamp-1">
                                {title}
                            </CardTitle>
                            {status && (
                                <span className={cn(
                                    "text-[10px] font-medium px-1.5 py-0.5 rounded-full uppercase tracking-wide",
                                    status === "active" && "bg-green-100 text-green-700",
                                    status === "draft" && "bg-yellow-100 text-yellow-700",
                                    status === "archived" && "bg-gray-100 text-gray-600",
                                )}>
                                    {status}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Description */}
                    {description && (
                        <CardDescription className="text-sm line-clamp-2 mb-4 min-h-[2.5rem]">
                            {description}
                        </CardDescription>
                    )}

                    {/* Stats */}
                    {stats && stats.length > 0 && (
                        <div className="flex items-center gap-4 pt-3 border-t text-xs text-muted-foreground">
                            {stats.map((stat, i) => (
                                <div key={i} className="flex items-center gap-1">
                                    <span className="font-medium text-foreground">{stat.value}</span>
                                    <span>{stat.label}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </Link>
    );
};

interface EntityItemProps {
    href: string;
    title: string;
    subtitle?: React.ReactNode;
    image?: React.ReactNode;
    actions?: React.ReactNode;
    onRemove?: () => void | Promise<void>;
    isRemoving?: boolean;
    className?: string;
};


export const EntityItem = ({
    href,
    title,
    subtitle,
    image,
    actions,
    onRemove,
    isRemoving,
    className,
}: EntityItemProps) => {
    const handleRemove = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (isRemoving) {
            return;
        }

        if (onRemove) {
            await onRemove();
        }
    }

    return (
        <Link href={href} prefetch>
            <Card
                className={cn("p-4 shadow-none hover:shadow cursor-pointer",
                isRemoving && "opacity-50 cursor-not-allowed",
                className
                )}
            >
                <CardContent className="flex flex-row items-center justify-between p-0">
                    <div className="flex items-center gap-3">
                        {image}
                        <div>
                            <CardTitle className="text-base font-medium">
                                {title}
                            </CardTitle>
                            {!!subtitle && (
                                <CardDescription className="text-xs">
                                    {subtitle}
                                </CardDescription>
                            )}
                        </div>
                    </div>
                    {(actions || onRemove) && ( 
                        <div className="flex gap-x-4 items-center">
                            {actions}
                            {onRemove && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={ (e) => e.stopPropagation()}
                                        >
                                           <DotsThreeVertical className="size-4"/> 
                                        </Button>

                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        align="end"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <DropdownMenuItem onClick={handleRemove}>
                                            <Trash className="size-4"/>
                                            Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </Link>
    )
};