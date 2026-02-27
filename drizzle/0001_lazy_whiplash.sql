CREATE TABLE `created_budgets` (
	`month` integer PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE `zero_budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`month` integer NOT NULL,
	`category` text NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`carryover` integer DEFAULT 0 NOT NULL,
	`goal` integer,
	`long_goal` integer,
	FOREIGN KEY (`category`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `zero_budgets_month_category_unique` ON `zero_budgets` (`month`,`category`);