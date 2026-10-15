CREATE TABLE signer_lease (
  signer_address  CHAR(42)    NOT NULL,
  updated_at      DATETIME(3) NOT NULL,
  PRIMARY KEY (signer_address)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
