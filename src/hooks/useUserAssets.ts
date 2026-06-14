import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface UserAsset {
    id: string;
    user_id: string;
    asset_type: string;
    file_name: string;
    file_url: string;
    size_bytes: number;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at?: string;
}

const PAGE_SIZE = 12;

/** Maps tab name to asset_type value stored in DB */
const TAB_TO_ASSET_TYPE: Record<string, string> = {
    'Videos': 'video',
    'Images': 'image',
    'Elements': 'element',
    'Animations': 'animation',
    'Effects': 'effect',
};

export const useUserAssets = (tab: string, searchQuery: string) => {
    const assetType = TAB_TO_ASSET_TYPE[tab] ?? tab.toLowerCase();

    return useInfiniteQuery({
        queryKey: ['userAssets', assetType, searchQuery],
        queryFn: async ({ pageParam = 0 }) => {
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) throw new Error('Not authenticated');

            let query = supabase
                .from('user_assets')
                .select('*', { count: 'exact' })
                .eq('user_id', user.id)
                .eq('asset_type', assetType)
                .order('created_at', { ascending: false })
                .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

            if (searchQuery.trim()) {
                query = query.ilike('file_name', `%${searchQuery}%`);
            }

            const { data, error, count } = await query;

            if (error) {
                console.warn('Could not fetch user_assets:', error.message);
                return { data: [], nextPage: undefined, totalCount: 0 };
            }

            return {
                data: data as UserAsset[],
                nextPage: data.length === PAGE_SIZE ? (pageParam as number) + 1 : undefined,
                totalCount: count,
            };
        },
        getNextPageParam: (lastPage) => lastPage.nextPage,
        initialPageParam: 0,
    });
};

/** Call this after a successful upload to instantly refresh the grid */
export const useInvalidateUserAssets = () => {
    const queryClient = useQueryClient();
    return (tab: string) => {
        const assetType = TAB_TO_ASSET_TYPE[tab] ?? tab.toLowerCase();
        queryClient.invalidateQueries({ queryKey: ['userAssets', assetType] });
    };
};
