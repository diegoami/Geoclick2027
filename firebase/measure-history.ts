// Synthetic public fixtures only: no credentials, Firebase connection or player data.
// Run: node --import tsx firebase/measure-history.ts
import { encodeCloudProgressEvent } from '../app/src/lib/firestoreProgressTransport.ts';
import type { ProgressEvent } from '../app/src/lib/progressEvents.ts';
const owner = { projectId: 'demo-geoclick-sync', uid: 'synthetic-measurement-account' };
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const event = (n: number): ProgressEvent => ({
	version: 1,
	id: id(n),
	...owner,
	deviceId: id(0),
	sequence: n,
	logicalTime: n,
	parents: n === 1 ? [] : [id(n - 1)],
	operationKey: `answer/${id(n)}`,
	operation: {
		kind: 'answer',
		mapId: 'italy-regions',
		targetId: 'ITA-1658',
		roundId: `round-${id(Math.ceil(n / 20))}`,
		grade: 'good',
		date: '2026-11-03'
	}
});
const samples = [100, 1000, 10000].map((events) => {
	let jsonBytes = 0;
	for (let i = 1; i <= events; i++)
		jsonBytes += Buffer.byteLength(
			JSON.stringify(encodeCloudProgressEvent(event(i), owner)),
			'utf8'
		);
	const pages = Math.floor(events / 100) + 1;
	return {
		events,
		pagesPerFullScan: pages,
		returnedDocumentsPerScan: events,
		minimumDocumentReadsPerScan: events + (events % 100 === 0 ? 1 : 0),
		encodedJsonBytes: jsonBytes,
		averageEncodedJsonBytes: Math.round(jsonBytes / events)
	};
});
console.log(
	JSON.stringify(
		{
			kind: 'synthetic-wire-and-query-budget',
			notes:
				'JSON is not Firestore storage or network billing. Read estimates include the empty terminal query but exclude dependent rule reads and concurrent changes. No cloud requests made.',
			samples
		},
		null,
		2
	)
);
