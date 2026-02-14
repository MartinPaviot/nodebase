"use client";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import z from "zod";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

const formSchema = z.object({
    variableName: z
        .string()
        .min(1, { message: "Variable name is required" })
        .regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/, {
            message: "Variable name must start with a letter or underscore and contain only letters, numbers, and underscores",
        }),
    minutesOffset: z.coerce.number().min(0).max(120).optional(),
    restrictByAttendee: z.enum(["all", "external_only", "internal_only"]).optional(),
});

export type CalendarTriggerFormValues = z.infer<typeof formSchema>;

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (values: CalendarTriggerFormValues) => void;
    defaultValues?: Partial<CalendarTriggerFormValues>;
}

export const CalendarTriggerDialog = ({
    open,
    onOpenChange,
    onSubmit,
    defaultValues = {},
}: Props) => {
    const form = useForm<CalendarTriggerFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            variableName: defaultValues.variableName || "",
            minutesOffset: defaultValues.minutesOffset ?? 5,
            restrictByAttendee: defaultValues.restrictByAttendee || "all",
        },
    });

    useEffect(() => {
        if (open) {
            form.reset({
                variableName: defaultValues.variableName || "",
                minutesOffset: defaultValues.minutesOffset ?? 5,
                restrictByAttendee: defaultValues.restrictByAttendee || "all",
            });
        }
    }, [open, defaultValues, form]);

    const handleSubmit = (values: CalendarTriggerFormValues) => {
        onSubmit(values);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Calendar Trigger Configuration</DialogTitle>
                    <DialogDescription>
                        Configure when this trigger fires based on calendar events.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(handleSubmit)}
                        className="space-y-8 mt-4"
                    >
                        <FormField
                            control={form.control}
                            name="variableName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Variable Name</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="myCalendarTrigger"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        Use this name to reference calendar data in other nodes
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="minutesOffset"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Minutes Before Meeting</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            placeholder="5"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        How many minutes before the meeting to trigger the workflow
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="restrictByAttendee"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Attendee Filter</FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                    >
                                        <FormControl>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Select filter" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="all">All meetings</SelectItem>
                                            <SelectItem value="external_only">External attendees only</SelectItem>
                                            <SelectItem value="internal_only">Internal attendees only</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormDescription>
                                        Filter which meetings trigger this workflow
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter className="mt-4">
                            <Button type="submit">Save</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};
