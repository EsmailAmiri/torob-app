CREATE TABLE `catalogue_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `inquiries` (
	`owner` text NOT NULL,
	`id` text NOT NULL,
	`thread` text NOT NULL,
	`product_id` text NOT NULL,
	`offer_id` text NOT NULL,
	`status` text NOT NULL,
	`updated` integer NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`owner` text PRIMARY KEY NOT NULL,
	`window` integer NOT NULL,
	`count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`brand` text,
	`price` real,
	`offer_count` integer NOT NULL,
	`search` text NOT NULL,
	`summary` text NOT NULL,
	`detail` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `products_category` ON `products` (`category`);--> statement-breakpoint
CREATE INDEX `products_price` ON `products` (`price`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`owner` text NOT NULL,
	`id` text NOT NULL,
	`state` text NOT NULL,
	`updated` integer NOT NULL,
	`locked_until` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
--> statement-breakpoint
CREATE TABLE `shops` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE VIRTUAL TABLE product_search USING fts5(search, content='products', content_rowid='rowid', tokenize='unicode61');
--> statement-breakpoint
CREATE TRIGGER products_ai AFTER INSERT ON products BEGIN
 INSERT INTO product_search(rowid,search) VALUES(new.rowid,new.search);
END;
--> statement-breakpoint
CREATE TRIGGER products_ad AFTER DELETE ON products BEGIN
 INSERT INTO product_search(product_search,rowid,search) VALUES('delete',old.rowid,old.search);
END;
--> statement-breakpoint
CREATE TRIGGER products_au AFTER UPDATE ON products BEGIN
 INSERT INTO product_search(product_search,rowid,search) VALUES('delete',old.rowid,old.search);
 INSERT INTO product_search(rowid,search) VALUES(new.rowid,new.search);
END;
