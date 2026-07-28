// Full module tree for PulsePOS — mirrors the target feature set.
// built: true → working screen exists. phase → planned build phase.

export type NavLeaf = { label: string; href: string; built?: boolean; phase?: number };
export type NavGroup = { label: string; icon: string; children: NavLeaf[] };
export type NavItem = NavLeaf & { icon: string } | NavGroup;

export const NAV: NavItem[] = [
  { label: "Dashboard", href: "/", icon: "LayoutDashboard", built: true },
  { label: "Serial Number Track", href: "/serials/track", icon: "ScanBarcode", built: true },
  {
    label: "Inventory", icon: "Boxes",
    children: [
      { label: "Product List", href: "/inventory/products", built: true },
      { label: "Stock Entry", href: "/inventory/stock-entry", built: true },
      { label: "Stock Report", href: "/inventory/stock-report", built: true },
      { label: "Stock Report Detailed", href: "/inventory/stock-report-detailed", built: true },
      { label: "Stock Ledger Report", href: "/inventory/stock-ledger", built: true },
      { label: "Stock Transfer", href: "/inventory/transfer", phase: 3 },
      { label: "Stock Transfer History", href: "/inventory/transfer-history", phase: 3 },
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
    label: "Sales Requisition", icon: "ClipboardList",
    children: [
      { label: "Requisition", href: "/requisition", phase: 3 },
      { label: "Requisition Pending", href: "/requisition/pending", phase: 3 },
      { label: "Requisition History", href: "/requisition/history", phase: 3 },
    ],
  },
  {
    label: "Sales Quotation", icon: "FileText",
    children: [
      { label: "Quotation", href: "/quotation", phase: 3 },
      { label: "Pending Quotation", href: "/quotation/pending", phase: 3 },
      { label: "Quotation History", href: "/quotation/history", phase: 3 },
    ],
  },
  {
    label: "Return & Exchange", icon: "RefreshCcw",
    children: [
      { label: "Sales Return", href: "/returns/sale", phase: 2 },
      { label: "Return History", href: "/returns/history", phase: 2 },
      { label: "Return Products", href: "/returns/products", phase: 2 },
      { label: "Sales Exchange", href: "/exchange", phase: 2 },
      { label: "Exchange History", href: "/exchange/history", phase: 2 },
    ],
  },
  {
    label: "Purchase & Return", icon: "PackagePlus",
    children: [
      { label: "Purchase", href: "/purchase", built: true },
      { label: "Purchase History", href: "/purchase/history", phase: 2 },
      { label: "Purchase Products", href: "/purchase/products", phase: 2 },
      { label: "Purchase Return", href: "/purchase/return", phase: 3 },
    ],
  },
  {
    label: "CRM", icon: "Users",
    children: [
      { label: "Customers", href: "/customers", built: true },
      { label: "Customer History", href: "/customers/history", phase: 2 },
    ],
  },
  {
    label: "SMS Management", icon: "MessageSquare",
    children: [
      { label: "SMS Dashboard", href: "/sms", phase: 4 },
      { label: "SMS Campaign", href: "/sms/campaign", phase: 4 },
      { label: "SMS Log", href: "/sms/log", phase: 4 },
      { label: "SMS Ledger", href: "/sms/ledger", phase: 4 },
    ],
  },
  {
    label: "Accounting", icon: "Calculator",
    children: [
      { label: "Daily Statement", href: "/accounting/daily", built: true },
      { label: "Cash Statement", href: "/accounting/daily", built: true },
      { label: "Manage Journal", href: "/accounting/journal", phase: 4 },
      { label: "Expense Voucher", href: "/accounting/expense", built: true },
      { label: "Due Collection", href: "/accounting/due-collection", built: true },
      { label: "Supplier Payment", href: "/accounting/supplier-payment", built: true },
      { label: "Ledger", href: "/accounting/ledger", built: true },
      { label: "Trial Balance", href: "/accounting/trial-balance", built: true },
      { label: "Profit Or Loss", href: "/accounting/pnl", built: true },
      { label: "Balance Sheet", href: "/accounting/balance-sheet", built: true },
      { label: "Chart of Account", href: "/accounting/coa", built: true },
    ],
  },
  {
    label: "Warranty", icon: "ShieldCheck",
    children: [{ label: "Warranty Claim", href: "/warranty/claims", phase: 2 }],
  },
  {
    label: "EMI", icon: "CalendarClock",
    children: [
      { label: "Create EMI Order", href: "/emi/create", phase: 3 },
      { label: "EMI History", href: "/emi/history", phase: 3 },
      { label: "Pending Installment", href: "/emi/pending", phase: 3 },
      { label: "Payment History", href: "/emi/payments", phase: 3 },
    ],
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
      { label: "Role Management", href: "/config/roles", phase: 4 },
    ],
  },
  {
    label: "Reports", icon: "BarChart3",
    children: [{ label: "Day Book", href: "/reports/daybook", phase: 4 }],
  },
];
