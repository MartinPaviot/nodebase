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
import { Switch } from "@/components/ui/switch";
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
    requireConfirmation: z.boolean().optional(),
    toSource: z.enum(["external_attendee", "manual"]).optional(),
    bccSource: z.enum(["user_email", "none"]).optional(),
    subjectTemplate: z.string().optional(),
    bodyPrompt: z.string().optional(),
    saveDraft: z.boolean().optional(),
});

export type GmailFormValues = z.infer<typeof formSchema>;

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (values: GmailFormValues) => void;
    defaultValues?: Partial<GmailFormValues>;
}

export const GmailDialog = ({
    open,
    onOpenChange,
    onSubmit,
    defaultValues = {},
}: Props) => {
    const form = useForm<GmailFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            variableName: defaultValues.variableName || "",
            requireConfirmation: defaultValues.requireConfirmation ?? true,
            toSource: defaultValues.toSource || "external_attendee",
            bccSource: defaultValues.bccSource || "user_email",
            subjectTemplate: defaultValues.subjectTemplate || "",
            bodyPrompt: defaultValues.bodyPrompt || "",
            saveDraft: defaultValues.saveDraft ?? false,
        },
    });

    useEffect(() => {
        if (open) {
            form.reset({
                variableName: defaultValues.variableName || "",
                requireConfirmation: defaultValues.requireConfirmation ?? true,
                toSource: defaultValues.toSource || "external_attendee",
                bccSource: defaultValues.bccSource || "user_email",
                subjectTemplate: defaultValues.subjectTemplate || "",
                bodyPrompt: defaultValues.bodyPrompt || "",
                saveDraft: defaultValues.saveDraft ?? false,
            });
        }
    }, [open, defaultValues, form]);

    const handleSubmit = (values: GmailFormValues) => {
        onSubmit(values);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Gmail Configuration</DialogTitle>
                    <DialogDescription>
                        Configure how follow-up emails are drafted and sent.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(handleSubmit)}
                        className="space-y-6 mt-4"
                    >
                        <FormField
                            control={form.control}
                            name="variableName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Variable Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="myGmail" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="requireConfirmation"
                            render={({ field }) => (
                                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                                    <div className="space-y-0.5">
                                        <FormLabel>Require Confirmation</FormLabel>
                                        <FormDescription>
                                            Review and approve emails before they are sent
                                        </FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="toSource"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Recipient</FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                    >
                                        <FormControl>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Select recipient source" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="external_attendee">Auto-detect external attendee</SelectItem>
                                            <SelectItem value="manual">Manual</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="bccSource"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>BCC</FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                    >
                                        <FormControl>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Select BCC option" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="user_email">BCC myself</SelectItem>
                                            <SelectItem value="none">No BCC</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="subjectTemplate"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Subject Template</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="{{meetingTitle}} - Follow Up"
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
                        <FormField
                            control={form.control}
                            name="bodyPrompt"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Body Prompt</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Write a concise follow-up email summarizing key discussion points and next steps..."
                                            className="min-h-[100px] font-mono text-sm"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        Instructions for the AI to generate the email body
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="saveDraft"
                            render={({ field }) => (
                                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                                    <div className="space-y-0.5">
                                        <FormLabel>Save as Draft</FormLabel>
                                        <FormDescription>
                                            Save email as draft instead of sending
                                        </FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
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
