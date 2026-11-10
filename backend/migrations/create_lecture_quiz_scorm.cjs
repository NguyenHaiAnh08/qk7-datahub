// backend/migrations/create_lecture_quiz_scorm.cjs
const { getPool, sql } = require('../src/db');

async function migrate() {
  const pool = await getPool();
  console.log('[Lecture Extended] Bắt đầu...');

  // ═══════════════════════════════════════════════════════════
  // 1. LECTURE_QUIZ_QUESTION — Câu hỏi trắc nghiệm (PP Quiz)
  // GV tạo câu hỏi trong bài giảng, khi trình chiếu sẽ click
  // để hiện câu hỏi cho học viên trả lời
  // ═══════════════════════════════════════════════════════════
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'LECTURE_QUIZ_QUESTION')
    BEGIN
      CREATE TABLE LECTURE_QUIZ_QUESTION (
        question_id       VARCHAR(50)   NOT NULL PRIMARY KEY,
        lecture_id        VARCHAR(50)   NOT NULL,
        question_order    INT           NOT NULL DEFAULT 1,
        question_text     NVARCHAR(MAX) NOT NULL,
        option_a          NVARCHAR(500) NOT NULL,
        option_b          NVARCHAR(500) NOT NULL,
        option_c          NVARCHAR(500) NULL,
        option_d          NVARCHAR(500) NULL,
        correct_answer    CHAR(1)       NOT NULL,          -- A | B | C | D
        explanation       NVARCHAR(MAX) NULL,              -- giải thích đáp án
        slide_index       INT           NULL,              -- slide nào của PP
        points            INT           NOT NULL DEFAULT 1,
        active            BIT           NOT NULL DEFAULT 1,
        created_at        DATETIME      NOT NULL DEFAULT GETDATE(),
        updated_at        DATETIME      NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_Quiz_Lecture FOREIGN KEY (lecture_id)
          REFERENCES DIGITAL_LECTURE(lecture_id) ON DELETE CASCADE,
        CONSTRAINT CK_Quiz_Correct CHECK (correct_answer IN ('A','B','C','D'))
      );
      CREATE INDEX IX_Quiz_Lecture ON LECTURE_QUIZ_QUESTION(lecture_id, question_order);
      PRINT '✅ LECTURE_QUIZ_QUESTION created';
    END
  `);

  // ═══════════════════════════════════════════════════════════
  // 2. LECTURE_QUIZ_ATTEMPT — Lịch sử trả lời quiz (khi HS click)
  // Lưu để GV xem lớp trả lời đúng/sai bao nhiêu
  // ═══════════════════════════════════════════════════════════
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'LECTURE_QUIZ_ATTEMPT')
    BEGIN
      CREATE TABLE LECTURE_QUIZ_ATTEMPT (
        attempt_id        BIGINT        IDENTITY(1,1) PRIMARY KEY,
        question_id       VARCHAR(50)   NOT NULL,
        schedule_id       VARCHAR(50)   NOT NULL,          -- ca dạy nào
        student_count_yes INT           NOT NULL DEFAULT 0, -- bao nhiêu HS giơ tay đúng
        student_count_no  INT           NOT NULL DEFAULT 0,
        answered_at       DATETIME      NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_Attempt_Question FOREIGN KEY (question_id)
          REFERENCES LECTURE_QUIZ_QUESTION(question_id) ON DELETE CASCADE,
        CONSTRAINT FK_Attempt_Schedule FOREIGN KEY (schedule_id)
          REFERENCES TEACHING_SCHEDULE(schedule_id) ON DELETE CASCADE
      );
      CREATE INDEX IX_Attempt_Schedule ON LECTURE_QUIZ_ATTEMPT(schedule_id);
      CREATE INDEX IX_Attempt_Question ON LECTURE_QUIZ_ATTEMPT(question_id);
      PRINT '✅ LECTURE_QUIZ_ATTEMPT created';
    END
  `);

  // ═══════════════════════════════════════════════════════════
  // 3. SCORM_PACKAGE — Metadata gói SCORM 1.2 đã upload
  // ═══════════════════════════════════════════════════════════
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SCORM_PACKAGE')
    BEGIN
      CREATE TABLE SCORM_PACKAGE (
        package_id        VARCHAR(50)   NOT NULL PRIMARY KEY,
        lecture_id        VARCHAR(50)   NOT NULL UNIQUE,
        original_name     NVARCHAR(255) NOT NULL,          -- tên file .zip gốc
        stored_path       NVARCHAR(500) NOT NULL,          -- thư mục giải nén
        entry_point       NVARCHAR(500) NOT NULL,          -- đường dẫn index.html (relative)
        manifest_xml      NVARCHAR(MAX) NULL,              -- nội dung imsmanifest.xml
        schema_version    VARCHAR(20)   NOT NULL DEFAULT '1.2',
        file_size         BIGINT        NULL,
        sha256            CHAR(64)      NULL,
        uploaded_by       VARCHAR(50)   NULL,
        uploaded_at       DATETIME      NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_Scorm_Lecture FOREIGN KEY (lecture_id)
          REFERENCES DIGITAL_LECTURE(lecture_id) ON DELETE CASCADE,
        CONSTRAINT FK_Scorm_Uploader FOREIGN KEY (uploaded_by)
          REFERENCES [USER](user_id)
      );
      PRINT '✅ SCORM_PACKAGE created';
    END
  `);

  // ═══════════════════════════════════════════════════════════
  // 4. Mở rộng TEACHING_SCHEDULE: slide_index, quiz_answered
  // ═══════════════════════════════════════════════════════════
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME='TEACHING_SCHEDULE' AND COLUMN_NAME='slide_index'
    )
      ALTER TABLE TEACHING_SCHEDULE ADD slide_index INT NULL;
  `);
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME='TEACHING_SCHEDULE' AND COLUMN_NAME='slide_total'
    )
      ALTER TABLE TEACHING_SCHEDULE ADD slide_total INT NULL;
  `);
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME='TEACHING_SCHEDULE' AND COLUMN_NAME='scorm_progress'
    )
      ALTER TABLE TEACHING_SCHEDULE ADD scorm_progress FLOAT NULL;   -- 0.0 - 1.0
  `);
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME='TEACHING_SCHEDULE' AND COLUMN_NAME='faculty_unit_id'
    )
      ALTER TABLE TEACHING_SCHEDULE ADD faculty_unit_id VARCHAR(50) NULL;
  `);
  console.log('✅ Đã mở rộng TEACHING_SCHEDULE (+4 cột)');

  // ═══════════════════════════════════════════════════════════
  // 5. Mở rộng DIGITAL_LECTURE: quiz_count cache
  // ═══════════════════════════════════════════════════════════
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME='DIGITAL_LECTURE' AND COLUMN_NAME='quiz_count'
    )
      ALTER TABLE DIGITAL_LECTURE ADD quiz_count INT NOT NULL DEFAULT 0;
  `);
  console.log('✅ Đã mở rộng DIGITAL_LECTURE (+1 cột)');

  console.log('[Lecture Extended] ✅ HOÀN TẤT.');
}

migrate().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });