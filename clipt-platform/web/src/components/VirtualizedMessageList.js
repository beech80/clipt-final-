import React, { useRef, useEffect } from 'react';
import { VariableSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import memoize from 'memoize-one';
import ChatMessage from './ChatMessage';
import './StreamChat.css';

/**
 * VirtualizedMessageList Component
 * 
 * Efficiently renders large numbers of chat messages using virtualization
 * Only messages visible in the viewport are actually rendered to the DOM
 * Features:
 * - Variable message height calculation
 * - Auto-scrolling to bottom for new messages
 * - Smooth scrolling
 * - Memoized row rendering for performance
 */
const VirtualizedMessageList = ({
  messages,
  currentUser,
  isModerator,
  onTimeoutUser,
  onBanUser
}) => {
  // Refs
  const listRef = useRef(null);
  const sizeMap = useRef({});
  const lastMeasuredIndex = useRef(-1);
  const lastScrollOffset = useRef(0);
  const isAutoScrolling = useRef(true);
  
  // Initialize estimated row heights - these will be dynamically adjusted
  const defaultMessageHeight = 42; // Regular message
  const donationMessageHeight = 80; // Donation messages are larger
  const systemMessageHeight = 30; // System messages are smaller
  
  // Get item size function (memoized)
  const getItemSize = (index) => {
    const item = messages[index];
    const knownSize = sizeMap.current[index];
    
    if (knownSize !== undefined) {
      return knownSize;
    }
    
    // If we haven't measured this item yet, use estimated size
    let estimatedHeight;
    
    switch (item.type) {
      case 'donation':
        estimatedHeight = donationMessageHeight;
        break;
      case 'system':
      case 'moderation':
        estimatedHeight = systemMessageHeight;
        break;
      default:
        // Calculate based on message content length
        const contentLength = item.content ? item.content.length : 0;
        // Longer messages will wrap and need more height
        if (contentLength > 200) {
          estimatedHeight = defaultMessageHeight * 3;
        } else if (contentLength > 100) {
          estimatedHeight = defaultMessageHeight * 2;
        } else {
          estimatedHeight = defaultMessageHeight;
        }
    }
    
    // Emotes take up more vertical space
    if (item.emotes && item.emotes.length > 0) {
      estimatedHeight += 10;
    }
    
    return estimatedHeight;
  };
  
  // Create item data for memoization
  const createItemData = memoize((messages, currentUser, isModerator, onTimeoutUser, onBanUser) => ({
    messages,
    currentUser,
    isModerator,
    onTimeoutUser,
    onBanUser
  }));
  
  const itemData = createItemData(
    messages,
    currentUser,
    isModerator,
    onTimeoutUser,
    onBanUser
  );
  
  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (listRef.current && isAutoScrolling.current) {
      listRef.current.scrollToItem(messages.length - 1, 'end');
    }
  }, [messages]);
  
  // Handle scroll events to manage auto-scrolling
  const handleScroll = ({ scrollOffset, scrollDirection }) => {
    const isNearBottom = listRef.current && 
      scrollOffset >= listRef.current.props.height * 0.8;
    
    // Enable auto-scrolling when user is near bottom and scrolling down
    if (isNearBottom && scrollDirection === 'forward') {
      isAutoScrolling.current = true;
    }
    
    // Disable auto-scrolling when user is scrolling up
    if (scrollDirection === 'backward' && !isNearBottom) {
      isAutoScrolling.current = false;
    }
    
    lastScrollOffset.current = scrollOffset;
  };
  
  // Row renderer with message measurement
  const Row = ({ index, style, data }) => {
    const rowRef = useRef(null);
    const message = data.messages[index];
    
    // After rendering, measure the actual row height and update our size map
    useEffect(() => {
      if (rowRef.current) {
        const node = rowRef.current;
        const height = node.getBoundingClientRect().height;
        
        // If height has changed or isn't set yet
        if (sizeMap.current[index] !== height) {
          sizeMap.current[index] = height;
          
          // Only reset the List cache if this item's measurement changes
          // and it's already been measured before
          if (index <= lastMeasuredIndex.current) {
            if (listRef.current) {
              listRef.current.resetAfterIndex(index);
            }
          }
          
          lastMeasuredIndex.current = Math.max(lastMeasuredIndex.current, index);
        }
      }
    }, [index, message]);
    
    return (
      <div ref={rowRef} style={style}>
        <ChatMessage
          message={message}
          currentUser={data.currentUser}
          isModerator={data.isModerator}
          onTimeoutUser={data.onTimeoutUser}
          onBanUser={data.onBanUser}
        />
      </div>
    );
  };
  
  return (
    <div className="virtualized-message-list">
      <AutoSizer>
        {({ height, width }) => (
          <List
            ref={listRef}
            height={height}
            width={width}
            itemCount={messages.length}
            itemSize={getItemSize}
            itemData={itemData}
            onScroll={handleScroll}
            overscanCount={5} // Render extra items for smoother scrolling
            style={{ overscrollBehavior: 'contain' }}
          >
            {Row}
          </List>
        )}
      </AutoSizer>
    </div>
  );
};

export default VirtualizedMessageList;
