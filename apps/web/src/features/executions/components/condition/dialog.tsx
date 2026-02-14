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
import { useForm, useFieldArray } from "react-hook-form";
import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { createId } from "@paralleldrive/cuid2";
import { Plus, Trash } from "@phosphor-icons/react";

const conditionBranchSchema = z.object({
    id: z.string().min(1),
    label: z.string().min(1, "Branch name is required"),
    prompt: z.string().min(1, "Condition prompt is required"),
    evaluator: z.enum(["domain_check", "domain_check_inverse", "llm_classify", "llm_classify_inverse"]),
});

const formSchema = z.object({
    variableName: z
        .string()
        .min(1, { message: "Variable name is required" })
        .regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/, {
            message: "Variable name must start with a letter or underscore and contain only letters, numbers, and underscores",
        }),
    conditions: z.array(conditionBranchSchema).min(1, "At least one condition is required"),
});

export type ConditionFormValues = z.infer<typeof formSchema>;

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (values: ConditionFormValues) => void;
    defaultValues?: Partial<ConditionFormValues>;
}

export const ConditionDialog = ({
    open,
    onOpenChange,
    onSubmit,
    defaultValues = {},
}: Props) => {
    const form = useForm<ConditionFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            variableName: defaultValues.variableName || "",
            conditions: defaultValues.conditions || [
                { id: createId(), label: "", prompt: "", evaluator: "llm_classify" },
            ],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "conditions",
    });

    useEffect(() => {
        if (open) {
            form.reset({
                variableName: defaultValues.variableName || "",
                conditions: defaultValues.conditions || [
                    { id: createId(), label: "", prompt: "", evaluator: "llm_classify" },
                ],
            });
        }
    }, [open, defaultValues, form]);

    const handleSubmit = (values: ConditionFormValues) => {
        onSubmit(values);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Condition Configuration</DialogTitle>
                    <DialogDescription>
                        Define branch conditions for this workflow node.
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
                                        <Input
                                            placeholder="myCondition"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <FormLabel>Conditions</FormLabel>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => append({
                                        id: createId(),
                                        label: "",
                                        prompt: "",
                                        evaluator: "llm_classify",
                                    })}
                                >
                                    <Plus className="size-4 mr-1" />
                                    Add Condition
                                </Button>
                            </div>

                            {fields.map((field, index) => (
                                <div key={field.id} className="border rounded-lg p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium">Branch {index + 1}</span>
                                        {fields.length > 1 && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => remove(index)}
                                            >
                                                <Trash className="size-4" />
                                            </Button>
                                        )}
                                    </div>

                                    <FormField
                                        control={form.control}
                                        name={`conditions.${index}.label`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Branch Name</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="e.g. Sales Meeting" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name={`conditions.${index}.prompt`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Condition Prompt</FormLabel>
                                                <FormControl>
                                                    <Textarea
                                                        placeholder="Is this a sales meeting with an external prospect?"
                                                        className="min-h-[60px]"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name={`conditions.${index}.evaluator`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Evaluator</FormLabel>
                                                <Select
                                                    onValueChange={field.onChange}
                                                    defaultValue={field.value}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger className="w-full">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="llm_classify">LLM Classify</SelectItem>
                                                        <SelectItem value="llm_classify_inverse">LLM Classify (Inverse)</SelectItem>
                                                        <SelectItem value="domain_check">Domain Check</SelectItem>
                                                        <SelectItem value="domain_check_inverse">Domain Check (Inverse)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormDescription>
                                                    LLM Classify uses AI to evaluate. Domain Check checks for external attendees.
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            ))}
                        </div>

                        <DialogFooter className="mt-4">
                            <Button type="submit">Save</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};
