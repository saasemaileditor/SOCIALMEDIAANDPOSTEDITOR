import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface UserProject {
    id: string;
    title: string;
    created_at: string;
    width: number;
    height: number;
    aspect_ratio: string;
    thumbnail_url?: string;
}

const PAGE_SIZE = 12;

export const useUserProjects = (searchQuery: string) => {
    return useInfiniteQuery({
        queryKey: ['userProjects', searchQuery],
        queryFn: async ({ pageParam = 0 }) => {
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) throw new Error("Not authenticated");

            let query = supabase
                .from('projects')
                .select('*', { count: 'exact' })
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

            if (searchQuery) {
                query = query.ilike('title', `%${searchQuery}%`);
            }

            const { data, error, count } = await query;

            if (error) {
                throw error;
            }

            return {
                data: data as UserProject[],
                nextPage: data.length === PAGE_SIZE ? pageParam + 1 : undefined,
                totalCount: count
            };
        },
        getNextPageParam: (lastPage) => lastPage.nextPage,
        initialPageParam: 0,
    });
};
