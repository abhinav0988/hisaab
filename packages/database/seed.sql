INSERT OR IGNORE INTO categories (id,user_id,name,type,icon,colour,is_system,created_at,updated_at) VALUES
('sys-exp-food',NULL,'Food and Dining','EXPENSE','Utensils','#D97706',1,datetime('now'),datetime('now')),
('sys-exp-groceries',NULL,'Groceries','EXPENSE','ShoppingBasket','#65A30D',1,datetime('now'),datetime('now')),
('sys-exp-housing',NULL,'Housing','EXPENSE','House','#7C3AED',1,datetime('now'),datetime('now')),
('sys-exp-transport',NULL,'Transport','EXPENSE','Bus','#2563EB',1,datetime('now'),datetime('now')),
('sys-exp-shopping',NULL,'Shopping','EXPENSE','ShoppingBag','#DB2777',1,datetime('now'),datetime('now')),
('sys-exp-healthcare',NULL,'Healthcare','EXPENSE','HeartPulse','#DC2626',1,datetime('now'),datetime('now')),
('sys-exp-education',NULL,'Education','EXPENSE','GraduationCap','#4F46E5',1,datetime('now'),datetime('now')),
('sys-exp-utilities',NULL,'Utilities','EXPENSE','Plug','#0891B2',1,datetime('now'),datetime('now')),
('sys-exp-entertainment',NULL,'Entertainment','EXPENSE','Clapperboard','#9333EA',1,datetime('now'),datetime('now')),
('sys-exp-travel',NULL,'Travel','EXPENSE','Plane','#0284C7',1,datetime('now'),datetime('now')),
('sys-exp-family',NULL,'Family','EXPENSE','Users','#EA580C',1,datetime('now'),datetime('now')),
('sys-exp-personal',NULL,'Personal Care','EXPENSE','Sparkles','#C026D3',1,datetime('now'),datetime('now')),
('sys-exp-other',NULL,'Other','EXPENSE','Shapes','#64748B',1,datetime('now'),datetime('now')),
('sys-inc-salary',NULL,'Salary','INCOME','BriefcaseBusiness','#15803D',1,datetime('now'),datetime('now')),
('sys-inc-freelance',NULL,'Freelance','INCOME','Laptop','#0F766E',1,datetime('now'),datetime('now')),
('sys-inc-business',NULL,'Business','INCOME','Building2','#047857',1,datetime('now'),datetime('now')),
('sys-inc-investment',NULL,'Investment','INCOME','ChartNoAxesCombined','#166534',1,datetime('now'),datetime('now')),
('sys-inc-gift',NULL,'Gift','INCOME','Gift','#059669',1,datetime('now'),datetime('now')),
('sys-inc-refund',NULL,'Refund','INCOME','RotateCcw','#0D9488',1,datetime('now'),datetime('now')),
('sys-inc-other',NULL,'Other Income','INCOME','CircleDollarSign','#3F6212',1,datetime('now'),datetime('now'));

INSERT OR IGNORE INTO account_catalog (id,type,name,description,sort_order,is_active,created_at,updated_at) VALUES
('catalog-cash','CASH','Cash','Physical cash and day-to-day notes',1,1,datetime('now'),datetime('now')),
('catalog-bank','BANK','Bank','Savings or current bank account',2,1,datetime('now'),datetime('now')),
('catalog-upi','UPI','UPI','UPI apps and linked bank handles',3,1,datetime('now'),datetime('now')),
('catalog-wallet','MOBILE_WALLET','Wallet','Mobile wallets and prepaid balances',4,1,datetime('now'),datetime('now')),
('catalog-credit','CREDIT_CARD','Credit card','Credit card spending',5,1,datetime('now'),datetime('now')),
('catalog-debit','DEBIT_CARD','Debit card','Debit card linked to your bank',6,1,datetime('now'),datetime('now'));
