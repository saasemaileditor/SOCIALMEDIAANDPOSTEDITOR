import { useVirtualizer } from '@tanstack/react-virtual';
import React, { useRef, useEffect } from 'react';
import { SkeletonCard } from './ui/SkeletonCard';

export interface VirtualizedGridProps<T> {
  items: T[];
  columnCount: number;
  width: number;
  height: number | string;
  itemHeight?: number;
  itemWidth?: number | string;
  renderItem: (item: T, index: number) => React.ReactNode;
  getItemId: (item: T) => string;
  onScrollEnd?: () => void;
  onScrollStart?: () => void;
  isFetchingNextPage?: boolean;
  isFetchingPreviousPage?: boolean;
  loadOnce?: boolean;

  // Page windowing props for sliding window data (maxPages)
  totalCount?: number;
  pageSize?: number;
  firstPageParam?: number;

  onResetScroll?: (resetFn: () => void) => void;
  renderSkeleton?: () => React.ReactNode;
}

export function VirtualizedGrid<T>({
  items,
  columnCount,
  width,
  height,
  itemHeight,
  itemWidth,
  renderItem,
  getItemId,
  onScrollEnd,
  onScrollStart,
  isFetchingNextPage,
  isFetchingPreviousPage,
  loadOnce = false,
  totalCount,
  pageSize,
  firstPageParam = 0,
  onResetScroll,
  renderSkeleton,
}: VirtualizedGridProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const isFetchingRef = useRef(false);
  const hasScrolledToBottomRef = useRef(false);

  useEffect(() => {
    if (onResetScroll) {
      onResetScroll(() => {
        if (parentRef.current) {
          parentRef.current.scrollTop = 0;
        }
        isFetchingRef.current = false;
        hasScrolledToBottomRef.current = false;
      });
    }
  }, [onResetScroll]);

  // Bug Fix: Reset state when items change (e.g. search)
  useEffect(() => {
    hasScrolledToBottomRef.current = false;
    isFetchingRef.current = false;
  }, [items]);

  const activeItemCount = totalCount ?? (isFetchingNextPage ? items.length + columnCount * 2 : items.length);
  const rowCount = Math.ceil(activeItemCount / columnCount);

  const gap = 12;
  const resolvedItemHeight = itemHeight ?? 140;
  const rowHeight = resolvedItemHeight + gap;
  const TOP_PADDING = 8; // pushes first row below the panel header

  const H_PADDING = 16;
  const SCROLLBAR_WIDTH = 14;
  const totalGapWidth = (columnCount - 1) * gap;
  const availableWidth = width - totalGapWidth - (H_PADDING * 2) - SCROLLBAR_WIDTH;
  const calculatedItemWidth = Math.max(40, Math.floor(availableWidth / columnCount));
  const resolvedItemWidth = typeof itemWidth === 'number' ? itemWidth : calculatedItemWidth;

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;

    // Check bottom
    if (onScrollEnd && !isFetchingRef.current && !isFetchingNextPage) {
      const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 100;
      if (isNearBottom && (!loadOnce || !hasScrolledToBottomRef.current)) {
        hasScrolledToBottomRef.current = true;
        isFetchingRef.current = true;
        onScrollEnd();
        setTimeout(() => { isFetchingRef.current = false; }, 200);
        return;
      }
    }

    // Check top
    if (onScrollStart && !isFetchingRef.current && !isFetchingPreviousPage) {
      const isNearTop = target.scrollTop < 100;
      if (isNearTop && firstPageParam > 0) {
        isFetchingRef.current = true;
        onScrollStart();
        setTimeout(() => { isFetchingRef.current = false; }, 200);
      }
    }

    if (target.scrollTop > 100) {
      hasScrolledToBottomRef.current = false;
    }
  };

  return (
    <div
      ref={parentRef}
      style={{ height, width, overflowY: 'auto', overflowX: 'hidden' }}
      className="scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent dark:scrollbar-thumb-gray-600"
      onScroll={handleScroll}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize() + TOP_PADDING}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const startIndex = virtualRow.index * columnCount;

          return (
            <div
              key={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start + TOP_PADDING}px)`,
                display: 'flex',
                gap: `${gap}px`,
                padding: `0 ${H_PADDING}px`,
                boxSizing: 'border-box',
              }}
            >
              {Array.from({ length: columnCount }).map((_, localIndex) => {
                const globalIndex = startIndex + localIndex;
                const relativeIndex = totalCount ? globalIndex - (firstPageParam * (pageSize ?? 1)) : globalIndex;
                const item = items[relativeIndex];

                if (!item) {
                  const isPastEnd = totalCount ? globalIndex >= totalCount : globalIndex >= items.length;
                  if (isPastEnd) return <div key={`empty-${globalIndex}`} style={{ width: resolvedItemWidth, height: resolvedItemHeight, flexShrink: 0 }} />;

                  return (
                    <div
                      key={`skeleton-${globalIndex}`}
                      style={{
                        width: typeof resolvedItemWidth === 'number' ? `${resolvedItemWidth}px` : resolvedItemWidth,
                        height: `${resolvedItemHeight}px`,
                        flexShrink: 0,
                      }}
                    >
                      {renderSkeleton ? renderSkeleton() : <SkeletonCard />}
                    </div>
                  );
                }

                return (
                  <div
                    key={getItemId(item)}
                    style={{
                      width: typeof resolvedItemWidth === 'number' ? `${resolvedItemWidth}px` : resolvedItemWidth,
                      height: `${resolvedItemHeight}px`,
                      flexShrink: 0,
                    }}
                  >
                    {renderItem(item, globalIndex)}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
