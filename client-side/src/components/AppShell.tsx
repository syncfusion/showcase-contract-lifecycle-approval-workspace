import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import {
  AppBarComponent,
  BreadcrumbComponent,
  BreadcrumbItemDirective,
  BreadcrumbItemsDirective,
  SidebarComponent,
  type ChangeEventArgs,
} from "@syncfusion/ej2-react-navigations";
import { ButtonComponent, SwitchComponent } from "@syncfusion/ej2-react-buttons";
import { Moon, Sun } from "lucide-react";
import type { ThemeMode } from "../hooks/useTheme";
import WorkflowStepper from "./WorkflowStepper";
import "../styles/app-shell.css";

interface AppShellProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  children: ReactNode;
}

const DESKTOP_MQ = "(min-width: 1024px)";

function screenTitleFor(pathname: string): string {
  if (pathname.startsWith("/publish")) return "Sign & publish";
  if (pathname.startsWith("/review")) return "Review & approval";
  if (pathname.startsWith("/editor")) return "Editor workspace";
  return "Dashboard";
}

function isDesktopViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia(DESKTOP_MQ).matches;
}

export default function AppShell({ theme, onToggleTheme, children }: AppShellProps) {
  const location = useLocation();
  const sidebarRef = useRef<SidebarComponent>(null);
  const [isOpen, setIsOpen] = useState(isDesktopViewport);
  const [isDesktop, setIsDesktop] = useState(isDesktopViewport);
  const currentScreen = screenTitleFor(location.pathname);

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ);
    const onChange = () => {
      const desktop = mq.matches;
      setIsDesktop(desktop);
      setIsOpen(desktop);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (!window.matchMedia(DESKTOP_MQ).matches) {
        sidebarRef.current?.hide(event);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleToggle = useCallback(() => {
    setIsOpen((open) => !open);
  }, []);

  const handleSidebarChange = useCallback((args: ChangeEventArgs) => {
    const nowOpen = args.element.classList.contains("e-open");
    setIsOpen((prev) => (prev === nowOpen ? prev : nowOpen));
  }, []);

  const handleNavClick = useCallback(() => {
    if (!window.matchMedia(DESKTOP_MQ).matches) {
      sidebarRef.current?.hide();
    }
  }, []);

  return (
    <div className="claw-app-shell" id="claw-app-shell">
      <SidebarComponent
        ref={sidebarRef}
        id="claw-sidebar"
        className="claw-sidebar"
        width="248px"
        dockSize="60px"
        enableDock
        type={isDesktop ? "Push" : "Over"}
        position="Left"
        isOpen={isOpen}
        target="#claw-app-shell"
        showBackdrop={!isDesktop}
        closeOnDocumentClick={!isDesktop}
        enableGestures={!isDesktop}
        animate
        change={handleSidebarChange}
      >
        <div className="claw-sidebar-inner">
          <div className="claw-brand">
            <div className="claw-brand-mark" aria-hidden="true">
              CL
            </div>
            <div className="claw-brand-text">
              <div className="claw-brand-title">Contract Lifecycle</div>
              <div className="claw-brand-sub">Approval Workspace</div>
            </div>
          </div>

          <div className="claw-eyebrow claw-nav-label">Workflow</div>
          <WorkflowStepper sidebarOpen={isOpen} onNavigated={handleNavClick} />

          <div className="claw-sidebar-footer">
            Demo data is synthetic — edits reset on reload.
          </div>
        </div>
      </SidebarComponent>

      <div className="claw-main e-main-content">
        <a href="#main-content" className="claw-skip-link">
          Skip to main content
        </a>
        <AppBarComponent colorMode="Inherit" cssClass="claw-topbar" isSticky>
          <div className="claw-topbar-start">
            <ButtonComponent
              type="button"
              cssClass="claw-icon-button"
              iconCss="e-icons e-menu"
              onClick={handleToggle}
              aria-label={isOpen ? "Collapse navigation" : "Expand navigation"}
              aria-controls="claw-sidebar"
              aria-expanded={isOpen}
            />
            <nav aria-label="Breadcrumb">
            <BreadcrumbComponent
              cssClass="claw-breadcrumb"
              enableNavigation={false}
              overflowMode="Wrap"
            >
              <BreadcrumbItemsDirective>
                <BreadcrumbItemDirective text="Contract operations" />
                <BreadcrumbItemDirective text={currentScreen} />
              </BreadcrumbItemsDirective>
            </BreadcrumbComponent>
            </nav>
          </div>
          <span className="e-appbar-spacer" />
          <div className="claw-top-actions">
            <div className="claw-theme-toggle" title="Toggle theme">
              <span className="claw-theme-toggle-icon" aria-hidden="true">
                {theme === "light" ? (
                  <Sun size={18} strokeWidth={1.75} />
                ) : (
                  <Moon size={18} strokeWidth={1.75} />
                )}
              </span>
              <SwitchComponent
                cssClass="claw-theme-switch"
                checked={theme === "dark"}
                change={onToggleTheme}
                aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
              />
            </div>
            <div
              className="claw-avatar"
              aria-label="Current user: Maya Chen"
              title="Maya Chen"
            >
              MC
            </div>
          </div>
        </AppBarComponent>

        <main className="claw-content" id="main-content">
          <div className="claw-content-inner">{children}</div>
        </main>
      </div>
    </div>
  );
}
