CREATE TABLE `schedule_task` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `created_at` datetime(3) DEFAULT NULL,
  `updated_at` datetime(3) DEFAULT NULL,
  `task` varchar(64) DEFAULT NULL,
  `state` smallint DEFAULT NULL,
  `data` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_task` (`task`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci