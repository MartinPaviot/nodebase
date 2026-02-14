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
    target: z.enum(["user_dm", "channel"]).optional(),
    channelId: z.string().optional(),
    messageTemplate: z.enum(["auto", "custom"]).optional(),
    customMessage: z.string().optional(),
});

export type SlackDMFormValues = z.infer<typeof formSchema>;

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (values: SlackDMFormValues) => void;
    defaultValues?: Partial<SlackDMFormValues>;
}

export const SlackDMDialog = ({
    open,
    onOpenChange,
    onSubmit,
    defaultValues = {},
}: Props) => {
    const form = useForm<SlackDMFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            variableName: defaultValues.variableName || "",
            target: defaultValues.target || "user_dm",
            channelId: defaultValues.channelId || "",
            messageTemplate: defaultValues.messageTemplate || "auto",
            customMessage: defaultValues.customMessage || "",
        },
    });

    useEffect(() => {
        if (open) {
            form.reset({
                variableName: defaultValues.variableName || "",
                target: defaultValues.target || "user_dm",
                channelId: defaultValues.channelId || "",
                messageTemplate: defaultValues.messageTemplate || "auto",
                customMessage: defaultValues.customMessage || "",
            });
        }
    }, [open, defaultValues, form]);

    const watchTarget = form.watch("target");
    const watchMessageTemplate = form.watch("messageTemplate");

    const handleSubmit = (values: SlackDMFormValues) => {
        onSubmit(values);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Slack DM Configuration</DialogTitle>
                    <DialogDescription>
                        Configure Slack direct message notification settings.
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
                                        <Input placeholder="mySlackDM" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="target"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Target</FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                    >
                                        <FormControl>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Select target" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="user_dm">Direct Message to User</SelectItem>
                                            <SelectItem value="channel">Channel</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        {watchTarget === "channel" && (
                            <FormField
                                control={form.control}
                                name="channelId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Channel ID</FormLabel>
                                        <FormControl>
                                            <Input placeholder="C01234ABCDE" {...field} />
                                        </FormControl>
                                        <FormDescription>
                                            Slack channel ID to send messages to
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}
                        <FormField
                            control={form.control}
                            name="messageTemplate"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Message Template</FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                    >
                                        <FormControl>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Select template" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="auto">Auto-generate from context</SelectItem>
                                            <SelectItem value="custom">Custom message</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        {watchMessageTemplate === "custom" && (
                            <FormField
                                control={form.control}
                                name="customMessage"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Custom Message</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder={"Meeting notes: {{summary}}"}
                                                className="min-h-[80px] font-mono text-sm"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            {"Use {{variables}} for dynamic values"}
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}
                        <DialogFooter className="mt-4">
                            <Button type="submit">Save</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};
