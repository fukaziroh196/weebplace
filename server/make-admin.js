// Скрипт для назначения пользователя администратором
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'weebplace.db');
const db = new sqlite3.Database(dbPath);

const username = process.argv[2];

if (!username) {
  console.error('Usage: node make-admin.js <username>');
  process.exit(1);
}

db.run('UPDATE users SET is_admin = 1 WHERE username = ?', [username], function(err) {
  if (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
  
  if (this.changes === 0) {
    console.log(`User "${username}" not found`);
  } else {
    console.log(`✓ User "${username}" is now an admin`);
  }
  
  db.close();
});

