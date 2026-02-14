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
import { Textarea } from "@/components/ui/textarea";
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
    botName: z.string().optional(),
    meetingUrlSource: z.enum(["calendarEvent", "context", "manual"]).optional(),
    joinMessage: z.string().optional(),
});

export type MeetingRecorderFormValues = z.infer<typeof formSchema>;

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (values: MeetingRecorderFormValues) => void;
    defaultValues?: Partial<MeetingRecorderFormValues>;
}

export const MeetingRecorderDialog = ({
    open,
    onOpenChange,
    onSubmit,
    defaultValues = {},
}: Props) => {
    const form = useForm<MeetingRecorderFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            variableName: defaultValues.variableName || "",
            botName: defaultValues.botName || "",
            meetingUrlSource: defaultValues.meetingUrlSource || "calendarEvent",
            joinMessage: defaultValues.joinMessage || "",
        },
    });

    useEffect(() => {
        if (open) {
            form.reset({
                variableName: defaultValues.variableName || "",
                botName: defaultValues.botName || "",
                meetingUrlSource: defaultValues.meetingUrlSource || "calendarEvent",
                joinMessage: defaultValues.joinMessage || "",
            });
        }
    }, [open, defaultValues, form]);

    const handleSubmit = (values: MeetingRecorderFormValues) => {
        onSubmit(values);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Meeting Recorder Configuration</DialogTitle>
                    <DialogDescription>
                        Configure the meeting recording bot settings.
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
                                        <Input placeholder="myRecorder" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="botName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Bot Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Nodebase Notetaker" {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        The name displayed when the bot joins the meeting
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="meetingUrlSource"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Meeting URL Source</FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                    >
                                        <FormControl>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Select source" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="calendarEvent">From Calendar Event</SelectItem>
                                            <SelectItem value="context">From Context</SelectItem>
                                            <SelectItem value="manual">Manual URL</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormDescription>
                                        Where to get the meeting URL from
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="joinMessage"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Join Message</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Nodebase is recording this meeting for notes and follow-up."
                                            className="min-h-[80px]"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        Message displayed when the bot joins the meeting
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
