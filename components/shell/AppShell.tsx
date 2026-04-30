import { SidebarNav } from './SidebarNav';
import { TopNavBar } from './TopNavBar';
import { BottomNavBar } from './BottomNavBar';
import { FloatingAddButton } from './FloatingAddButton';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <TopNavBar />
      <SidebarNav />
      <main className="relative z-0 flex min-w-0 flex-col pt-14 pb-24 lg:pl-72 lg:pb-8">
        {children}
      </main>
      <BottomNavBar />
      <FloatingAddButton />
    </div>
  );
}
