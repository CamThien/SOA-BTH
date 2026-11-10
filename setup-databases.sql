-- Run with SQL Server Management Studio or sqlcmd. SQL Server TIMESTAMP is
-- rowversion, so datetime2 is used for dates in this assignment.
IF DB_ID('product_db') IS NULL CREATE DATABASE product_db;
GO
IF DB_ID('order_db') IS NULL CREATE DATABASE order_db;
GO
USE product_db;
GO
IF OBJECT_ID('dbo.products', 'U') IS NULL
CREATE TABLE dbo.products (
 id INT IDENTITY PRIMARY KEY,
 name VARCHAR(255) NOT NULL,
 description VARCHAR(MAX) NULL,
 price DECIMAL(10,2) NOT NULL CHECK(price >= 0),
 quantity INT NOT NULL DEFAULT 0 CHECK(quantity >= 0),
 created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
 updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
);
GO
USE order_db;
GO
IF OBJECT_ID('dbo.orders', 'U') IS NULL
CREATE TABLE dbo.orders (
 id INT IDENTITY PRIMARY KEY,
 customer_name VARCHAR(255) NOT NULL,
 customer_email VARCHAR(255) NOT NULL,
 total_amount DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK(total_amount >= 0),
 status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','cancelled')),
 created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
 updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
);
IF OBJECT_ID('dbo.order_items', 'U') IS NULL
CREATE TABLE dbo.order_items (
 id INT IDENTITY PRIMARY KEY,
 order_id INT NOT NULL REFERENCES dbo.orders(id),
 product_id INT NOT NULL,
 product_name VARCHAR(255) NOT NULL,
 quantity INT NOT NULL CHECK(quantity > 0),
 unit_price DECIMAL(10,2) NOT NULL CHECK(unit_price >= 0),
 total_price DECIMAL(10,2) NOT NULL CHECK(total_price >= 0)
);
GO
