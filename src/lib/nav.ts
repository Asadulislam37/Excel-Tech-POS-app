// Module tree for Excel Tech POS.
// built: true → working screen exists. phase → planned build phase.

export type NavLeaf = { label: string; href: string; built?: boolean; phase?: number };
export type NavGroup = { label: string; icon?: string; children: NavNode[] };
export type NavNode = NavLeaf | NavGroup;
export type NavItem = (NavLeaf & { icon: string }) | (NavGroup & { icon: string });

export const isGroup = (n: NavNode): n is NavGroup => (n as NavGroup).children !== undefined;

export const NAV: NavItem[] = [
  { label: "Dashboard", href: "/", icon: "LayoutDashboard", built: true },
  { label: "AI Assistant", href: "/assistant", icon: "Bot", built: true },
  { label: "Serial Number Track", href: "/serials/track", icon: "ScanBarcode", built: true },
  {
    label: "Inventory", icon: "Boxes",
    children: [
      { label: "Product List", href: "/inventory/products", built: true },
      { label: "Stock Entry", href: "/inventory/stock-entry", built: true },
      { label: "Stock Report", href: "/inventory/stock-report", built: true },
      { label: "Stock Report Detailed", href: "/inventory/stock-report-detailed", built: true },
      { label: "Stock Ledger Report", href: "/inventory/stock-ledger", built: true },
      {
        label: "Stock Transfer", icon: "ShoppingCart",
        children: [
          { label: "Stock Transfer", href: "/inventory/transfer", built: true },
          { label: "Stock Transfer History", href: "/inventory/transfer-history", built: true },
        ],
      },
      { label: "Serial Number Manage", href: "/inventory/serials", built: true },
    ],
  },
  {
    label: "Sales", icon: "ShoppingCart",
    children: [
      { label: "Create Invoice", href: "/sales/pos", built: true },
      { label: "Sold History", href: "/sales/history", built: true },
      { label: "Sold Products", href: "/sales/products", built: true },
    ],
  },
  {
    label: "Online Store", icon: "Globe",
    children: [
      { label: "Online Orders", href: "/online-orders", built: true },
      { label: "View Shop", href: "/shop", built: true },
    ],
  },
  {
    label: "Return & Exchange", icon: "RefreshCcw",
    children: [
      {
        label: "Return", icon: "ShoppingCart",
        children: [
          { label: "Sales Return", href: "/returns/sale", built: true },
          { label: "Return History", href: "/returns/history", built: true },
          { label: "Return Products", href: "/returns/products", built: true },
        ],
      },
      {
        label: "Exchange", icon: "PackagePlus",
        children: [
          { label: "Sales Exchange", href: "/exchange", built: true },
          { label: "Exchange History", href: "/exchange/history", built: true },
          { label: "Exchange Products", href: "/exchange/products", built: true },
          { label: "Return Products", href: "/exchange/return-products", built: true },
        ],
      },
    ],
  },
  {
    label: "Purchase & Return", icon: "PackagePlus",
    children: [
      {
        label: "Purchase", icon: "ShoppingCart",
        children: [
          { label: "Purchase", href: "/purchase", built: true },
          { label: "Purchase History", href: "/purchase/history", built: true },
          { label: "Purchase Products", href: "/purchase/products", built: true },
        ],
      },
      {
        label: "Purchase Return", icon: "FileText",
        children: [
          { label: "Purchase Return", href: "/purchase/return", built: true },
          { label: "Return History", href: "/purchase/return/history", built: true },
          { label: "Return Products", href: "/purchase/return/products", built: true },
        ],
      },
    ],
  },
  {
    label: "CRM", icon: "Users",
    children: [
      { label: "Customers", href: "/customers", built: true },
      { label: "Customer History", href: "/customers/history", built: true },
    ],
  },
  {
    label: "SMS Management", icon: "MessageSquare",
    children: [
      { label: "SMS Dashboard", href: "/sms", phase: 4 },
      { label: "SMS Campaign", href: "/sms/campaign", phase: 4 },
      {
        label: "SMS Report", icon: "FileText",
        children: [
          { label: "SMS Payment History", href: "/sms/payments", phase: 4 },
          { label: "SMS Log", href: "/sms/log", phase: 4 },
          { label: "SMS Ledger", href: "/sms/ledger", phase: 4 },
        ],
      },
    ],
  },
  {
    label: "Accounting", icon: "Calculator",
    children: [
      { label: "Daily Statement", href: "/accounting/daily", built: true },
      { label: "Cash Statement", href: "/accounting/cash", built: true },
      { label: "Manage Journal", href: "/accounting/journal", built: true },
      { label: "Expense Voucher", href: "/accounting/expense", built: true },
      { label: "Due Collection", href: "/accounting/due-collection", built: true },
      { label: "Party KPI", href: "/accounting/party-kpi", built: true },
      { label: "Supplier Payment", href: "/accounting/supplier-payment", built: true },
      { label: "Supplier KPI", href: "/accounting/supplier-kpi", built: true },
      { label: "Money Transfer", href: "/accounting/money-transfer", built: true },
      { label: "Money Adjustment", href: "/accounting/money-adjustment", built: true },
      { label: "Ledger", href: "/accounting/ledger", built: true },
      { label: "Trial Balance", href: "/accounting/trial-balance", built: true },
      { label: "Profit Or Loss", href: "/accounting/pnl", built: true },
      { label: "Balance Sheet", href: "/accounting/balance-sheet", built: true },
      { label: "Chart of Account", href: "/accounting/coa", built: true },
      { label: "Chart Of Account Opening", href: "/accounting/opening", built: true },
    ],
  },
  {
    label: "Warranty", icon: "ShieldCheck",
    children: [{ label: "Warranty Claim", href: "/warranty/claims", phase: 2 }],
  },
  {
    label: "Rewards", icon: "Gift",
    children: [
      { label: "Reward Point Setup", href: "/rewards/setup", phase: 5 },
      { label: "Reward Level", href: "/rewards/levels", phase: 5 },
      { label: "Reward Point History", href: "/rewards/history", phase: 5 },
    ],
  },
  {
    label: "Configuration", icon: "Settings",
    children: [
      { label: "Brand", href: "/config/brand", built: true },
      { label: "Category", href: "/config/category", built: true },
      { label: "Color", href: "/config/color", built: true },
      { label: "Size / Storage", href: "/config/size", built: true },
      { label: "Outlet", href: "/config/outlet", built: true },
      { label: "Supplier", href: "/config/supplier", built: true },
      { label: "Unit", href: "/config/unit", built: true },
      { label: "Warranty", href: "/config/warranty", built: true },
      { label: "Delivery Charge", href: "/config/delivery", built: true },
      { label: "AI & Pre-orders", href: "/config/ai", built: true },
      { label: "User Management", href: "/config/users", built: true },
    ],
  },
  {
    label: "Reports", icon: "BarChart3",
    children: [{ label: "Day Book", href: "/reports/daybook", phase: 4 }],
  },
];
