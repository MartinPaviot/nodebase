

import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useWorkflowsParams } from "./use-workflows-params";

/**
* Hook to fetch all workflows using suspense
*/
export const useSuspenseWorkflows = () => {
    const trpc = useTRPC();
    const [params] = useWorkflowsParams();

    return useSuspenseQuery(trpc.workflows.getMany.queryOptions(params));
};

/**
* Hook to create a new workflow
*/
export const useCreateWorkflow = () => {
    const queryClient = useQueryClient();
    const trpc = useTRPC();
    const [params] = useWorkflowsParams();

    return useMutation(
        trpc.workflows.create.mutationOptions({
            onSuccess: (data) => {
                toast.success(`Workflow "${data.name}" created`);
                // Update cache optimistically instead of invalidating all queries
                const queryKey = trpc.workflows.getMany.queryKey(params);
                queryClient.setQueryData(queryKey, (old) => {
                    if (!old) return old;
                    return {
                        ...old,
                        items: [data, ...old.items],
                        totalCount: old.totalCount + 1,
                    };
                });
            },
            onError: (error) => {
                toast.error(`Failed to create workflow: ${error.message}`);
            },
        }),
    );
};

/**
* Hook to remove a workflow
*/
export const useRemoveWorkflow = () => {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const [params] = useWorkflowsParams();

    return useMutation(
        trpc.workflows.remove.mutationOptions({
            onSuccess: (data) => {
                toast.success(`Workflow "${data.name}" removed`);
                // Update cache optimistically instead of invalidating all queries
                const queryKey = trpc.workflows.getMany.queryKey(params);
                queryClient.setQueryData(queryKey, (old) => {
                    if (!old) return old;
                    return {
                        ...old,
                        items: old.items.filter((w) => w.id !== data.id),
                        totalCount: old.totalCount - 1,
                    };
                });
                queryClient.removeQueries(
                    trpc.workflows.getOne.queryFilter({ id: data.id }),
                );
            }
        })
    )
}

/**
* Hook to fetch a single workflow using suspense
*/
export const useSuspenseWorkflow = (id: string) => {
    const trpc = useTRPC();
    return useSuspenseQuery(trpc.workflows.getOne.queryOptions({id}));
};

/**
* Hook to update a workflow name
*/
export const useUpdateWorkflowName = () => {
    const queryClient = useQueryClient();
    const trpc = useTRPC();
    const [params] = useWorkflowsParams();

    return useMutation(
        trpc.workflows.updateName.mutationOptions({
            onSuccess: (data) => {
                toast.success(`Workflow "${data.name}" updated`);
                // Update list cache optimistically
                const queryKey = trpc.workflows.getMany.queryKey(params);
                queryClient.setQueryData(queryKey, (old) => {
                    if (!old) return old;
                    return {
                        ...old,
                        items: old.items.map((w) => w.id === data.id ? data : w),
                    };
                });
                // Invalidate single item cache to refetch with full data
                queryClient.invalidateQueries(
                    trpc.workflows.getOne.queryOptions({ id: data.id }),
                );
            },
            onError: (error) => {
                toast.error(`Failed to update workflow: ${error.message}`);
            },
        }),
    );
};

/**
* Hook to update a workflow
*/
export const useUpdateWorkflow = () => {
    const queryClient = useQueryClient();
    const trpc = useTRPC();
    const [params] = useWorkflowsParams();

    return useMutation(
        trpc.workflows.update.mutationOptions({
            onSuccess: (data) => {
                toast.success(`Workflow "${data.name}" saved`);
                // Update list cache optimistically
                const queryKey = trpc.workflows.getMany.queryKey(params);
                queryClient.setQueryData(queryKey, (old) => {
                    if (!old) return old;
                    return {
                        ...old,
                        items: old.items.map((w) => w.id === data.id ? data : w),
                    };
                });
                // Invalidate single item cache to refetch with full data
                queryClient.invalidateQueries(
                    trpc.workflows.getOne.queryOptions({ id: data.id }),
                );
            },
            onError: (error) => {
                toast.error(`Failed to save workflow: ${error.message}`);
            },
        }),
    );
};

/**
* Hook to execute a workflow name
*/
export const useExecuteWorkflow = () => {
    const trpc = useTRPC();

    return useMutation(
        trpc.workflows.execute.mutationOptions({
            onSuccess: (data) => {
                toast.success(`Workflow "${data.name}" executed`);
            },
            onError: (error) => {
                toast.error(`Failed to execute workflow: ${error.message}`);
            },
        }),
    );
};