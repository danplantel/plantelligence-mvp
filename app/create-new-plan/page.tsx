'use client';

import CreateDashboard from '@/components/pages/create-dashboard';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRef } from 'react';

export default function Page() {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const scrollToTop = () => {
    const scrollRef = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollRef) {
      scrollRef.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    }
  };

  return (
    <ScrollArea ref={scrollAreaRef} className='h-full'>
      <div className='p-4 pt-6 space-y-4 md:p-8'>
        <CreateDashboard scrollToTop={scrollToTop} />
      </div>
    </ScrollArea>
  );
}
