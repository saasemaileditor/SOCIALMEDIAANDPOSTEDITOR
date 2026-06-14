import { useRef, useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { VirtualizedGrid } from './VirtualizedGrid';
import { GlobalLoader } from './ui/global-loader';
import {
    draggable,
    dropTargetForElements,
    monitorForElements,
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import {
    attachClosestEdge,
    extractClosestEdge,
} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import type { Edge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/types';

// ── Smart search helper ──────────────────────────────────────────────────────
function filterAndSortItems<T>(
  items: T[],
  query: string,
  getLabel: (item: T) => string
): T[] {
  if (!query.trim()) return items;
  const lowerQuery = query.toLowerCase();
  return items
    .filter((item) => getLabel(item).toLowerCase().includes(lowerQuery))
    .sort((a, b) => {
      const labelA = getLabel(a).toLowerCase();
      const labelB = getLabel(b).toLowerCase();
      const startsWithA = labelA.startsWith(lowerQuery);
      const startsWithB = labelB.startsWith(lowerQuery);
      if (startsWithA && !startsWithB) return -1;
      if (!startsWithA && startsWithB) return 1;
      return 0;
    });
}

// ── Props ────────────────────────────────────────────────────────────────────
export interface UniversalPanelProps<T> {
  items: T[];
  width: number;
  height?: number | string;
  itemHeight?: number;
  itemWidth?: number | string;
  loadOnce?: boolean;  // Prevent auto-loading more than once per scroll


  /** e.g. "Elements" — used for dynamic loading text and empty state */
  panelName: string;
  /** Lucide icon component shown in the empty-state illustration */
  panelIcon: React.ComponentType<{ size?: number; className?: string }>;

  searchQuery: string;
  onSearchChange: (q: string) => void;
  placeholder?: string;
  getItemLabel: (item: T) => string;

  isLoading?: boolean;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  fetchNextPage?: () => void;
  isFetchingPreviousPage?: boolean;
  hasPreviousPage?: boolean;
  fetchPreviousPage?: () => void;
  
  totalCount?: number;
  pageSize?: number;
  firstPageParam?: number;

  renderItem: (item: T, index: number, listeners?: any, attributes?: any) => React.ReactNode;
  getItemId: (item: T) => string;

  isDark?: boolean;

  // Header controls
  title?: React.ReactNode;
  onClose?: () => void;
  showCloseButton?: boolean;
  
  showSearch?: boolean;
  customHeaderContent?: React.ReactNode;
  emptyStateContent?: React.ReactNode;
  columnCount?: number;
  onReorder?: (oldIndex: number, newIndex: number) => void;
}

// ── Sortable Item Helper ──────────────────────────────────────────────────
function SortableItem<T>({ 
  id, 
  item, 
  index, 
  renderItem 
}: { 
  id: string, 
  item: T, 
  index: number; 
  renderItem: (item: T, index: number, listeners?: any, attributes?: any) => React.ReactNode 
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

  const isSortable = id !== 'canvas-background';

  useEffect(() => {
    if (!isSortable || !ref.current) return;
    const el = ref.current;

    const dragCleanup = draggable({
      element: el,
      getInitialData: () => ({ id, index }),
      onDragStart: () => setIsDragging(true),
      onDrop: () => setIsDragging(false),
    });

    const dropCleanup = dropTargetForElements({
      element: el,
      getData: ({ input }) => {
        return attachClosestEdge(
          { id, index },
          { element: el, input, allowedEdges: ['top', 'bottom'] }
        );
      },
      onDragEnter: (args) => setClosestEdge(extractClosestEdge(args.self.data)),
      onDrag: (args) => setClosestEdge(extractClosestEdge(args.self.data)),
      onDragLeave: () => setClosestEdge(null),
      onDrop: () => setClosestEdge(null),
    });

    return () => {
      dragCleanup();
      dropCleanup();
    };
  }, [id, index, isSortable]);

  return (
    <div ref={ref} className="relative z-[1]" style={{ opacity: isDragging ? 0.3 : 1 }}>
      {renderItem(item, index)}
      {closestEdge === 'top' && <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#7c3aed] z-10" />}
      {closestEdge === 'bottom' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#7c3aed] z-10" />}
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────
export function UniversalPanel<T>({
  items,
  width,
  height = '100%',
  itemHeight,
  itemWidth,
  panelName,
  panelIcon: PanelIcon,
  searchQuery,
  onSearchChange,
  placeholder = 'Search...',
  getItemLabel,
  isLoading = false,
  isFetchingNextPage = false,
  hasNextPage = false,
  fetchNextPage,
  isFetchingPreviousPage = false,
  hasPreviousPage = false,
  fetchPreviousPage,
  totalCount,
  pageSize,
  firstPageParam = 0,
  renderItem,
  getItemId,
  isDark = false,
  title,
  onClose,
  showCloseButton = true,
  loadOnce = false,
  showSearch = true,
  customHeaderContent = null,
  emptyStateContent = null,
  columnCount = 3,
  onReorder,
}: UniversalPanelProps<T>) {
  // ── Pragmatic Drag and Drop Monitor ─────────────────────────────────────────
  useEffect(() => {
    if (!onReorder) return;
    return monitorForElements({
      onDrop({ source, location }) {
        const target = location.current.dropTargets[0];
        if (!target) return;

        const sourceData = source.data;
        const targetData = target.data;

        if (sourceData.id === targetData.id) return;
        if (typeof sourceData.index !== 'number' || typeof targetData.index !== 'number') return;

        const closestEdgeOfTarget = extractClosestEdge(targetData);
        if (!closestEdgeOfTarget) return;

        let startIndex = sourceData.index as number;
        let finishIndex = targetData.index as number;
        
        if (startIndex < finishIndex && closestEdgeOfTarget === 'top') {
          finishIndex -= 1;
        } else if (startIndex > finishIndex && closestEdgeOfTarget === 'bottom') {
          finishIndex += 1;
        }

        onReorder(startIndex, finishIndex);
      }
    });
  }, [onReorder]);

  // ── Scroll reset ───────────────────────────────────────────────────────────
  const resetScrollRef = useRef<(() => void) | undefined>(undefined);

  // ── Debounced search ───────────────────────────────────────────────────────
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  const [isSearching, setIsSearching] = useState(false);


  useEffect(() => {
    if (searchQuery !== debouncedQuery) setIsSearching(true);
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setIsSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset scroll when settled query changes
  useEffect(() => {
    if (resetScrollRef.current) resetScrollRef.current();
  }, [debouncedQuery]);

  // Clear search on unmount
  useEffect(() => {
    return () => {
      onSearchChange('');
    };
  }, [onSearchChange]);

  // ── Smart filtering ────────────────────────────────────────────────────────
  const filteredItems = filterAndSortItems(items, debouncedQuery, getItemLabel);

  // ── Dynamic text ───────────────────────────────────────────────────────────
  const dynamicLoadingText = `Loading ${panelName.toLowerCase()}...`;
  const hasQuery = debouncedQuery.trim().length > 0;
  const isSearchEmpty = filteredItems.length === 0 && hasQuery && !isLoading && !isSearching;
  const isCompletelyEmpty = items.length === 0 && !hasQuery && !isLoading && !isSearching;
  const isShowLoading = isLoading;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1 min-h-0">

      {/* ── Header Controls ──────────────────────────────────────────────────── */}
      {title && (
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
          <span className={`font-bold text-[16px] ${isDark ? 'text-white' : 'text-gray-800'}`}>
            {title}
          </span>
          <div className="flex items-center gap-1">

            {showCloseButton && onClose && (
              <button
                onClick={onClose}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${isDark ? 'text-gray-400 hover:text-white hover:bg-gray-800' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                title="Close panel"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Search Bar / Custom Header Content ───────────────────────────────── */}
      <div className="px-4 pb-2 flex-shrink-0">
        {showSearch && (
          <div
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all ${
              isDark
                ? 'bg-[#161625] border-[#2a2d45] focus-within:border-[#7c3aed] focus-within:ring-1 focus-within:ring-[#7c3aed]/50'
                : 'bg-white border-gray-200 focus-within:border-[#7c3aed] focus-within:ring-1 focus-within:ring-[#7c3aed]/50'
            }`}
          >
            {/* Spinner while typing / loading or stable icon otherwise */}
            {isLoading || isSearching ? (
              <GlobalLoader size={16} fullScreen={false} className="flex-shrink-0" />
            ) : (
              <Search size={16} className={`flex-shrink-0 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
            )}

            <input
              type="text"
              placeholder={placeholder}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className={`flex-1 bg-transparent border-none outline-none text-sm font-medium w-full ${
                isDark ? 'text-white placeholder-gray-500' : 'text-gray-800 placeholder-gray-400'
              }`}
            />
          </div>
        )}
        
        {customHeaderContent}
      </div>

      {/* ── Loading State / Empty State / Grid ───────────────────────────────── */}
      {isShowLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[300px] select-none">
          {/* GlobalLoader - same position as empty state icon */}
          <GlobalLoader size={64} fullScreen={false} className="mb-4" />
          
          {/* Loading text - same style as "No results found" */}
          <p className={`text-lg font-semibold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {dynamicLoadingText}
          </p>
        </div>
      ) : isCompletelyEmpty && emptyStateContent ? (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[300px] select-none">
          {emptyStateContent}
        </div>
      ) : isSearchEmpty || isCompletelyEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[300px] select-none">
          {/* Icon - same mb-4 as loader */}
          <PanelIcon
            size={64}
            className={`mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`}
          />
          {/* Main text - same style as loading text */}
          <p className={`text-lg font-semibold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            No results found
          </p>
          {/* Sub text - NO margin top, directly below */}
          <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            Try a different search term
          </p>
        </div>
      ) : (
        /* ── Grid ──────────────────────────────────────────────────────────── */
        <div className="flex-1 min-h-0">
          <VirtualizedGrid
              items={filteredItems}
              columnCount={columnCount}
              width={width}
              height={height}
              itemHeight={itemHeight}
              itemWidth={itemWidth}
              getItemId={getItemId}
              renderItem={onReorder 
                ? (item, index) => (
                    <SortableItem 
                      id={getItemId(item)}
                      item={item}
                      index={index}
                      renderItem={renderItem}
                    />
                  )
                : renderItem
              }
              isFetchingNextPage={isFetchingNextPage}
              isFetchingPreviousPage={isFetchingPreviousPage}
              loadOnce={loadOnce}
              totalCount={totalCount}
              pageSize={pageSize}
              firstPageParam={firstPageParam}
              onScrollEnd={() => {
                if (hasNextPage && !isFetchingNextPage && fetchNextPage) {
                  fetchNextPage();
                }
              }}
              onScrollStart={() => {
                if (hasPreviousPage && !isFetchingPreviousPage && fetchPreviousPage) {
                  fetchPreviousPage();
                }
              }}
              onResetScroll={(fn) => { resetScrollRef.current = fn; }}
            />
        </div>
      )}
    </div>
  );
}
