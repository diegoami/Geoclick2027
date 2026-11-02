import { getCapacitorProgressDatabase } from './capacitorProgressRepository';
import {
	createSqliteJournalStore,
	SqliteProgressJournal,
	SqliteProgressJournalError
} from './sqliteProgressJournal';
import { progressOwnerKey, type ProgressOwner } from './progressEvents';
export async function createCapacitorProgressJournal(
	owner: ProgressOwner,
	deviceId: string
): Promise<SqliteProgressJournal> {
	const fixed = Object.freeze({ projectId: owner.projectId, uid: owner.uid });
	progressOwnerKey(fixed);
	if (typeof deviceId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(deviceId))
		throw new SqliteProgressJournalError('invalid-device-id');
	const db = await getCapacitorProgressDatabase();
	return new SqliteProgressJournal(
		fixed,
		createSqliteJournalStore({
			async query(sql, values) {
				const result = await db.query(sql, [...values]);
				if (!Array.isArray(result.values) || 'message' in result)
					throw new SqliteProgressJournalError('storage-read-failed');
				return result.values;
			},
			async execute(sql, values) {
				const result = await db.run(sql, [...values], false);
				return result.changes?.changes ?? -1;
			}
		}),
		{ deviceId }
	);
}
