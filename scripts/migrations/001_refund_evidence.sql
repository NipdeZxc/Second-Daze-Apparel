-- Additive migration for refund image/PDF evidence.
-- Safe to re-run; it does not drop or alter existing tables or records.
CREATE TABLE IF NOT EXISTS refund_evidence (
  evidence_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  refund_id INT UNSIGNED NOT NULL,
  file_name VARCHAR(180) NOT NULL,
  mime_type VARCHAR(40) NOT NULL,
  file_size INT UNSIGNED NOT NULL,
  file_data MEDIUMBLOB NOT NULL,
  uploaded_by INT UNSIGNED NOT NULL,
  uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (evidence_id),
  KEY ix_refund_evidence_refund (refund_id, uploaded_at),
  CONSTRAINT fk_refund_evidence_refund FOREIGN KEY (refund_id) REFERENCES refunds (refund_id) ON DELETE CASCADE,
  CONSTRAINT fk_refund_evidence_user FOREIGN KEY (uploaded_by) REFERENCES users (user_id),
  CONSTRAINT ck_refund_evidence_size CHECK (file_size > 0 AND file_size <= 2097152)
) ENGINE=InnoDB;
