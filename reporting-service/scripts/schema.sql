IF OBJECT_ID('dbo.orders_reports', 'U') IS NULL
CREATE TABLE dbo.orders_reports (
 id INT IDENTITY(1,1) PRIMARY KEY,
 order_id INT NOT NULL CHECK (order_id > 0),
 total_revenue DECIMAL(10,2) NOT NULL CHECK (total_revenue >= 0),
 total_cost DECIMAL(10,2) NOT NULL CHECK (total_cost >= 0),
 total_profit DECIMAL(10,2) NOT NULL,
 CONSTRAINT CK_orders_reports_profit CHECK(total_profit = total_revenue - total_cost)
);
IF OBJECT_ID('dbo.product_reports', 'U') IS NULL
CREATE TABLE dbo.product_reports (
 id INT IDENTITY(1,1) PRIMARY KEY,
 order_report_id INT NOT NULL,
 product_id INT NOT NULL CHECK (product_id > 0),
 total_sold INT NOT NULL CHECK (total_sold >= 0),
 revenue DECIMAL(10,2) NOT NULL CHECK (revenue >= 0),
 cost DECIMAL(10,2) NOT NULL CHECK (cost >= 0),
 profit DECIMAL(10,2) NOT NULL,
 CONSTRAINT FK_product_reports_order_report FOREIGN KEY(order_report_id) REFERENCES dbo.orders_reports(id) ON DELETE CASCADE,
 CONSTRAINT UQ_product_reports_order_product UNIQUE(order_report_id, product_id),
 CONSTRAINT CK_product_reports_profit CHECK(profit = revenue - cost)
);
