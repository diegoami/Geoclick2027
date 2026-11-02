import { getTauriProgressDatabase } from './sqliteProgressRepository';
import {
	createSqliteJournalStore,
	SqliteProgressJournal,
	SqliteProgressJournalError
} from './sqliteProgressJournal';
import { progressOwnerKey, type ProgressOwner } from './progressEvents';
export async function createTauriProgressJournal(
	owner: ProgressOwner,
	deviceId: string
): Promise<SqliteProgressJournal> {
	const fixed = Object.freeze({ projectId: owner.projectId, uid: owner.uid });
	progressOwnerKey(fixed);
	if (typeof deviceId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(deviceId))
		throw new SqliteProgressJournalError('invalid-device-id');
	const db = await getTauriProgressDatabase();
	return new SqliteProgressJournal(
		fixed,
		createSqliteJournalStore({
			query: (sql, values) => db.select<unknown[]>(sql, [...values]),
			execute: async (sql, values) => (await db.execute(sql, [...values])).rowsAffected
		}),
		{ deviceId }
	);
}
