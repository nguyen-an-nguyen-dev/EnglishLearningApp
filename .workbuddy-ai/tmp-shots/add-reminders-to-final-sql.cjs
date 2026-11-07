/**
 * Add `study_reminders` to backend/database/final.sql so a fresh import of the
 * dump has the table the companion needs. Inserted right after `users` because
 * its only foreign key points there; the table starts empty by design.
 */
const fs = require('fs')

const FILE = 'backend/database/final.sql'
const source = fs.readFileSync(FILE, 'utf8')

if (source.includes('CREATE TABLE `study_reminders`')) {
  console.log('study_reminders already in final.sql')
  process.exit(0)
}

// End of the users DDL block: the line closing it, right before "chats".
const marker = '-- chats\nCREATE TABLE `chats`'
const index = source.indexOf(marker)
if (index === -1) throw new Error('chats block not found')

const ddl = `-- study_reminders
CREATE TABLE \`study_reminders\` (
  \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  \`user_id\` bigint(20) unsigned NOT NULL,
  \`title\` varchar(160) NOT NULL,
  \`body\` varchar(500) DEFAULT NULL,
  \`due_at\` datetime NOT NULL,
  \`target_json\` varchar(500) DEFAULT NULL,
  \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
  \`delivered_at\` datetime DEFAULT NULL,
  \`dismissed_at\` datetime DEFAULT NULL,
  PRIMARY KEY (\`id\`),
  KEY \`idx_reminders_user_due\` (\`user_id\`,\`due_at\`),
  CONSTRAINT \`fk_reminders_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

`

fs.writeFileSync(FILE, source.slice(0, index) + ddl + source.slice(index))
console.log('inserted study_reminders DDL before the chats table')

const tables = (fs.readFileSync(FILE, 'utf8').match(/CREATE TABLE `/g) || []).length
console.log('total CREATE TABLE in final.sql:', tables)
