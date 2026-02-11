import { useQuery} from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

export const useSubscription = () => {
    return useQuery({
        queryKey: ["subscription"],
        queryFn: async () => {
            const { data } = await authClient.customer.state();
            return data;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes - subscription status rarely changes
        gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
        refetchOnWindowFocus: false, // Don't refetch on tab focus
        refetchOnMount: false, // Don't refetch if data exists
    });
};

export const useHasActiveSubscription = () => {
    const {data: customerState, isLoading, ...rest } = useSubscription();

    const hasActiveSubscription =
    customerState?.activeSubscriptions &&
    customerState.activeSubscriptions.length > 0;

    return {
        hasActiveSubscription,
        subscription: customerState?.activeSubscriptions?.[0],
        isLoading,
        ...rest,
    };
};