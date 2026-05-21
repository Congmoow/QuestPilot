const SidebarIcon = ({ size = 20, children, ...props }) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const SidebarDashboardIcon = (props) => (
  <SidebarIcon {...props}>
    <rect width="7" height="9" x="3" y="3" rx="1" />
    <rect width="7" height="5" x="14" y="3" rx="1" />
    <rect width="7" height="9" x="14" y="12" rx="1" />
    <rect width="7" height="5" x="3" y="16" rx="1" />
  </SidebarIcon>
);

export const SidebarQuestionBankIcon = (props) => (
  <SidebarIcon {...props}>
    <path d="M15 2h-4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8" />
    <path d="M16.706 2.706A2.4 2.4 0 0 0 15 2v5a1 1 0 0 0 1 1h5a2.4 2.4 0 0 0-.706-1.706z" />
    <path d="M5 7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 1.732-1" />
  </SidebarIcon>
);

export const SidebarPracticeIcon = (props) => (
  <SidebarIcon {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="m10 8l6 4l-6 4z" />
  </SidebarIcon>
);

export const SidebarWrongBookIcon = (props) => (
  <SidebarIcon {...props}>
    <path d="M12 21V7" />
    <path d="M16 12l2 2l4-4" />
    <path d="M22 6V4a1 1 0 0 0-1-1h-5a4 4 0 0 0-4 4a4 4 0 0 0-4-4H3a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h6a3 3 0 0 1 3 3a3 3 0 0 1 3-3h6a1 1 0 0 0 1-1v-1.3" />
  </SidebarIcon>
);

export const SidebarAiImportIcon = (props) => (
  <SidebarIcon {...props}>
    <path d="m21.64 3.64l-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72" />
    <path d="M14 7l3 3" />
    <path d="M5 6v4" />
    <path d="M19 14v4" />
    <path d="M10 2v2" />
    <path d="M7 8H3" />
    <path d="M21 16h-4" />
    <path d="M11 3H9" />
  </SidebarIcon>
);

export const SidebarAiChatIcon = (props) => (
  <SidebarIcon {...props}>
    <path d="M12 6V2H8" />
    <path d="M15 11v2" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="M20 16a2 2 0 0 1-2 2H8.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 4 20.286V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />
    <path d="M9 11v2" />
  </SidebarIcon>
);

export const SidebarSettingsIcon = (props) => (
  <SidebarIcon {...props}>
    <path d="M4 21v-7" />
    <path d="M4 10V3" />
    <path d="M12 21v-9" />
    <path d="M12 8V3" />
    <path d="M20 21v-5" />
    <path d="M20 12V3" />
    <path d="M2 14h4" />
    <path d="M10 8h4" />
    <path d="M18 16h4" />
  </SidebarIcon>
);
