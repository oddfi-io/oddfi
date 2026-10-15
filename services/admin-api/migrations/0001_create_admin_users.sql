-- 0001_create_admin_users.sql
-- 管理员白名单表：Lark 工作区成员中真正被授权访问后台的人
-- 参考：DD-098 §3.3 / .claude/rules/rbac.md

CREATE TABLE IF NOT EXISTS admin_users (
    lark_user_id  VARCHAR(64)  NOT NULL COMMENT 'Lark open id（ou_xxxx），主键',
    lark_name     VARCHAR(64)  NOT NULL COMMENT 'Lark 显示名',
    lark_email    VARCHAR(128) DEFAULT NULL COMMENT 'Lark 邮箱（可能为空）',
    lark_avatar   VARCHAR(256) DEFAULT NULL COMMENT 'Lark 头像 URL',
    role          VARCHAR(32)  NOT NULL COMMENT '角色：super_admin/operator/customer_service/finance',
    created_by    VARCHAR(64)  DEFAULT NULL COMMENT '添加此人的管理员 lark_user_id',
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (lark_user_id),
    INDEX idx_role (role),
    CONSTRAINT chk_admin_role CHECK (role IN ('super_admin','operator','customer_service','finance'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='OddFi 运营后台白名单';

-- 回滚（手动执行）：
-- DROP TABLE admin_users;

-- 首个超级管理员手动插入（lark_user_id 从 Lark 开放平台或用户调试接口拿）
-- INSERT INTO admin_users (lark_user_id, lark_name, lark_email, role, created_by)
-- VALUES ('ou_xxxxxxxxxxxx', '张三', 'zhangsan@oddfi.io', 'super_admin', 'BOOTSTRAP');
