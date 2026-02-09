

import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCredentialsParams } from "./use-credentials-params";
import { CredentialType } from "@/generated/prisma";

/**
* Hook to fetch all credentials using suspense
*/
export const useSuspenseCredentials = () => {
    const trpc = useTRPC();
    const [params] = useCredentialsParams();

    return useSuspenseQuery(trpc.credentials.getMany.queryOptions(params));
};

/**
* Hook to create a new credential
*/
export const useCreateCredential = () => {
    const queryClient = useQueryClient();
    const trpc = useTRPC();
    const [params] = useCredentialsParams();

    return useMutation(
        trpc.credentials.create.mutationOptions({
            onSuccess: (data) => {
                toast.success(`Credential "${data.name}" created`);
                // Update cache optimistically instead of invalidating all queries
                const queryKey = trpc.credentials.getMany.queryKey(params);
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
                toast.error(`Failed to create credential: ${error.message}`);
            },
        }),
    );
};

/**
* Hook to remove a credential
*/
export const useRemoveCredential = () => {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const [params] = useCredentialsParams();

    return useMutation(
        trpc.credentials.remove.mutationOptions({
            onSuccess: (data) => {
                toast.success(`Credential "${data.name}" removed`);
                // Update cache optimistically instead of invalidating all queries
                const queryKey = trpc.credentials.getMany.queryKey(params);
                queryClient.setQueryData(queryKey, (old) => {
                    if (!old) return old;
                    return {
                        ...old,
                        items: old.items.filter((c) => c.id !== data.id),
                        totalCount: old.totalCount - 1,
                    };
                });
                queryClient.removeQueries(
                    trpc.credentials.getOne.queryFilter({ id: data.id }),
                );
            }
        })
    )
}

/**
* Hook to fetch a single redential using suspense
*/
export const useSuspenseCredential = (id: string) => {
    const trpc = useTRPC();
    return useSuspenseQuery(trpc.credentials.getOne.queryOptions({id}));
};


/**
* Hook to update a credential
*/
export const useUpdateCredential = () => {
    const queryClient = useQueryClient();
    const trpc = useTRPC();
    const [params] = useCredentialsParams();

    return useMutation(
        trpc.credentials.update.mutationOptions({
            onSuccess: (data) => {
                toast.success(`Credential "${data.name}" saved`);
                // Update list cache optimistically
                const queryKey = trpc.credentials.getMany.queryKey(params);
                queryClient.setQueryData(queryKey, (old) => {
                    if (!old) return old;
                    return {
                        ...old,
                        items: old.items.map((c) => c.id === data.id ? data : c),
                    };
                });
                // Invalidate single item cache to refetch
                queryClient.invalidateQueries(
                    trpc.credentials.getOne.queryOptions({ id: data.id }),
                );
            },
            onError: (error) => {
                toast.error(`Failed to save credential: ${error.message}`);
            },
        }),
    );
};

/**
 * Hook to fetch credentials by type
 */

export const useCredentialsByType = (type: CredentialType ) => {
    const trpc = useTRPC();
    return useQuery(trpc.credentials.getByType.queryOptions({type}))
}
