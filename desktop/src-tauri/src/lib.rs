use tauri_plugin_sql::{Migration, MigrationKind};

// Progress persistence schema - mirrors app/src/lib/progressRepository.ts's
// ProgressRepository interface exactly (CardState/SessionSummary), so the
// SQLite-backed implementation is a straight swap for the localStorage one
// with no shape translation needed at the call sites. See DECISIONS.md.
fn migrations() -> Vec<Migration> {
  vec![Migration {
    version: 1,
    description: "create_progress_tables",
    sql: "
      CREATE TABLE card_states (
        map_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        ease_factor REAL NOT NULL,
        interval INTEGER NOT NULL,
        repetitions INTEGER NOT NULL,
        due_date TEXT NOT NULL,
        last_reviewed_at TEXT NOT NULL,
        PRIMARY KEY (map_id, target_id)
      );
      CREATE TABLE last_session_summaries (
        map_id TEXT PRIMARY KEY,
        total INTEGER NOT NULL,
        perfect INTEGER NOT NULL,
        total_errors INTEGER NOT NULL,
        completed_at TEXT NOT NULL
      );
    ",
    kind: MigrationKind::Up,
  }]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(
      tauri_plugin_sql::Builder::default()
        .add_migrations("sqlite:geoclick.db", migrations())
        .build(),
    )
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
