CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`offbudget` integer DEFAULT 0 NOT NULL,
	`closed` integer DEFAULT 0 NOT NULL,
	`sort_order` real DEFAULT 0,
	`tombstone` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`cat_group` text NOT NULL,
	`is_income` integer DEFAULT 0 NOT NULL,
	`sort_order` real DEFAULT 0,
	`hidden` integer DEFAULT 0 NOT NULL,
	`tombstone` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`cat_group`) REFERENCES `category_groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `category_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`is_income` integer DEFAULT 0 NOT NULL,
	`sort_order` real DEFAULT 0,
	`hidden` integer DEFAULT 0 NOT NULL,
	`tombstone` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `category_mapping` (
	`id` text PRIMARY KEY NOT NULL,
	`transfer_id` text
);
--> statement-breakpoint
CREATE TABLE `messages_clock` (
	`id` integer PRIMARY KEY NOT NULL,
	`clock` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `messages_crdt` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`timestamp` text NOT NULL,
	`dataset` text NOT NULL,
	`row` text NOT NULL,
	`column` text NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `messages_crdt_timestamp_unique` ON `messages_crdt` (`timestamp`);--> statement-breakpoint
CREATE TABLE `payee_mapping` (
	`id` text PRIMARY KEY NOT NULL,
	`target_id` text
);
--> statement-breakpoint
CREATE TABLE `payees` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`transfer_acct` text,
	`tombstone` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`transfer_acct`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`acct` text NOT NULL,
	`category` text,
	`amount` integer NOT NULL,
	`description` text,
	`notes` text,
	`date` integer NOT NULL,
	`cleared` integer DEFAULT 1 NOT NULL,
	`reconciled` integer DEFAULT 0 NOT NULL,
	`tombstone` integer DEFAULT 0 NOT NULL,
	`is_parent` integer DEFAULT 0 NOT NULL,
	`is_child` integer DEFAULT 0 NOT NULL,
	`parent_id` text,
	`sort_order` real DEFAULT 0,
	FOREIGN KEY (`acct`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`description`) REFERENCES `payees`(`id`) ON UPDATE no action ON DELETE no action
);
