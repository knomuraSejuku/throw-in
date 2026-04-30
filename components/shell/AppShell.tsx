import { SidebarNav } from './SidebarNav';
import { TopNavBar } from './TopNavBar';
import { BottomNavBar } from './BottomNavBar';
import { FloatingAddButton } from './FloatingAddButton';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <TopNavBar />
      <SidebarNav />
      {/* 
        lg:pl-72 offset for desktop sidebar
        pt-20 or pt-24 offset for top nav
        pb-24 offset for mobile bottom nav
      */}
      <main className="relative z-0 flex min-w-0 flex-col pt-20 pb-24 lg:pl-72 lg:pb-8">
        {children}
      </main>
      <BottomNavBar />
      <FloatingAddButton />
    </div>
  );
}
