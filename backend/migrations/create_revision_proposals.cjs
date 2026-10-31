const { getPool, sql } = require('../src/db');

async function migrate() {
  const pool = await getPool();
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DOCUMENT_REVISION_PROPOSAL')
    BEGIN
      CREATE TABLE DOCUMENT_REVISION_PROPOSAL (
        proposal_id VARCHAR(50) PRIMARY KEY,
        file_id VARCHAR(50) NOT NULL FOREIGN KEY REFERENCES DOCUMENT(file_id),
        requester_id VARCHAR(50) NOT NULL FOREIGN KEY REFERENCES [USER](user_id),
        document_code NVARCHAR(100),
        title NVARCHAR(500) NOT NULL,
        doc_type_id VARCHAR(20),
        issued_date DATE,
        issuing_unit_id VARCHAR(50),
        signer NVARCHAR(100),
        summary NVARCHAR(MAX),
        security_level_id INT NOT NULL,
        new_stored_path NVARCHAR(500),
        new_original_name NVARCHAR(255),
        new_mime_type VARCHAR(100),
        new_file_size BIGINT,
        new_sha256 CHAR(64),
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        note NVARCHAR(500),
        reviewed_by VARCHAR(50) FOREIGN KEY REFERENCES [USER](user_id),
        reviewed_at DATETIME,
        review_note NVARCHAR(500),
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME NOT NULL DEFAULT GETDATE()
      );
      CREATE INDEX IX_PROPOSAL_FILE ON DOCUMENT_REVISION_PROPOSAL(file_id);
      CREATE INDEX IX_PROPOSAL_STATUS ON DOCUMENT_REVISION_PROPOSAL(status);
      PRINT 'Table DOCUMENT_REVISION_PROPOSAL created successfully';
    END
    ELSE
    BEGIN
      PRINT 'Table DOCUMENT_REVISION_PROPOSAL already exists';
    END
  `);
  console.log('Migration completed successfully.');
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
