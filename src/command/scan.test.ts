import { IBaseItem, TestTable1 } from '../TableTest.dev';
import { setTimeout } from 'timers/promises';
import { randomNumber, randomString } from '../util/utils';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { dxScan } from './scan';
import { dxReset } from './reset';
import { A } from 'ts-toolbelt';

beforeEach(() => dxReset(TestTable1));

it('scan returns list of items', async () => {
	jest.useRealTimers();

	for (let i = 0; i < 10; i++) {
		const testString = randomString();
		const testNumber = randomNumber();

		const item = {
			pk: `test-${testNumber}`,
			sk: `test-${testString}`,
			testString,
			testNumber
		};

		await TestTable1.client.send(
			new PutCommand({
				TableName: TestTable1.config.name,
				Item: item
			})
		);
	}

	await setTimeout(1000);

	const result = await dxScan(TestTable1);

	const cursorTypeCheck: A.Equals<(typeof result)['cursorKey'], { pk: string; sk: string } | undefined> = 1;

	expect(cursorTypeCheck).toBe(1);

	const itemsTypeCheck: A.Equals<
		(typeof result)['items'],
		Array<
			IBaseItem & { pk: string; sk: string } & Partial<{
					gsi0Pk: string;
					gsi0Sk: string;
					gsi1Pk: number;
					gsi1Sk: number | undefined;
					gsi2Pk: string;
					gsi2Sk: number;
					gsi3Pk: number;
					gsi3Sk: string | undefined;
					gsi4Pk: string;
					gsi5Pk: number;
				}>
		>
	> = 1;

	expect(itemsTypeCheck).toBe(1);

	expect(result.items.length).toBe(10);
});

it('scan on index returns list of items', async () => {
	jest.useRealTimers();

	for (let i = 0; i < 10; i++) {
		const testString = randomString();
		const testNumber = randomNumber();

		const item = {
			pk: `test-${testNumber}`,
			sk: `test-${testString}`,
			gsi0Pk: `test-${testNumber}`,
			gsi0Sk: `test-${testString}`,
			testString,
			testNumber
		};

		await TestTable1.client.send(
			new PutCommand({
				TableName: TestTable1.config.name,
				Item: item
			})
		);
	}

	await setTimeout(1000);

	const result = await dxScan(TestTable1, {
		index: 'gsi0'
	});

	const cursorTypeCheck: A.Equals<
		(typeof result)['cursorKey'],
		{ pk: string; sk: string; gsi0Pk: string; gsi0Sk: string } | undefined
	> = 1;

	expect(cursorTypeCheck).toBe(1);

	expect(result.items.length).toBe(10);
});

it('limits and pages correctly', async () => {
	jest.useRealTimers();

	for (let i = 0; i < 10; i++) {
		const testString = randomString();
		const testNumber = randomNumber();

		const item = {
			pk: `test-${testNumber}`,
			sk: `test-${testString}`,
			testString,
			testNumber
		};

		await TestTable1.client.send(
			new PutCommand({
				TableName: TestTable1.config.name,
				Item: item
			})
		);
	}

	await setTimeout(1000);

	const result = await dxScan(TestTable1, {
		pageLimit: 5
	});

	expect(result.items.length).toBe(5);
	expect(result.cursorKey).toBeDefined();

	const result2 = await dxScan(TestTable1, {
		cursorKey: result.cursorKey
	});

	expect(result2.items.length).toBe(5);
	expect(result2.cursorKey).toBeUndefined();
});