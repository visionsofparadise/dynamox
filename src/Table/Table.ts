import { Constructor, ILogger, UnionToIntersection } from '../utils';
import { DocumentClient } from 'aws-sdk/lib/dynamodb/document_client';
import { ISIdxCfg, Item, IdxAFns } from '../Item/Item';
import { getters } from '../getters/getters';
import { putFn } from './put';
import { getFn } from './get';
import { createFn } from './create';
import { updateFn } from './update';
import { scanFn } from './scan';
import { deleteFn } from './delete';
import { queryFn } from './query';
import { resetFn } from './reset';
import { AttributeType, TableProps } from 'aws-cdk-lib/aws-dynamodb';

export type IdxAT = string | number | undefined;

export type IdxATL = 'string' | 'string?' | 'number' | 'number?';

export type IdxATLToType<TIdxATL extends IdxATL> = TIdxATL extends 'string'
	? string
	: TIdxATL extends 'string?'
	? string | undefined
	: TIdxATL extends 'number'
	? number
	: TIdxATL extends 'number?'
	? number | undefined
	: string | number;

export interface IdxACfg<TIdxA extends string = string, TIdxATL extends IdxATL = IdxATL> {
	attribute: TIdxA;
	type: TIdxATL;
}

export interface PIdxCfg<
	HKA extends string = string,
	RKA extends string = string,
	HKATL extends IdxATL = IdxATL,
	RKATL extends IdxATL = IdxATL
> {
	hashKey: IdxACfg<HKA, Exclude<HKATL, 'string?' | 'number?'>>;
	rangeKey?: IdxACfg<RKA, RKATL>;
}

export type IdxP<IdxPA extends string> = never | never[] | IdxPA[];

export interface IdxCfg<
	HKA extends string = string,
	RKA extends string = string,
	HKATL extends IdxATL = IdxATL,
	RKATL extends IdxATL = IdxATL,
	TIdxPA extends string = string,
	TIdxP extends IdxP<TIdxPA> = IdxP<TIdxPA>
> extends PIdxCfg<HKA, RKA, HKATL, RKATL> {
	project?: TIdxP;
}

export type IdxCfgM<
	TPIdxN extends string = string,
	TIdxA extends string = string,
	TIdxATL extends IdxATL = IdxATL,
	TIdxPA extends string = string,
	TIdxP extends IdxP<TIdxPA> = IdxP<TIdxPA>
> = Record<TPIdxN, PIdxCfg<TIdxA, TIdxA, TIdxATL, TIdxATL>> &
	Record<string, IdxCfg<TIdxA, TIdxA, TIdxATL, TIdxATL, TIdxPA, TIdxP>>;

export type IdxCfgMToKeyM<TIdxCfgM extends IdxCfgM> = {
	[x in keyof TIdxCfgM]: IdxKey<TIdxCfgM[x]>;
};

export type IdxKeys<
	Idx extends string & keyof TIdxCfgM = string,
	TIdxCfgM extends IdxCfgM = IdxCfgM
> = UnionToIntersection<IdxCfgMToKeyM<TIdxCfgM>[Idx]> & {};

export type IdxKey<TIdxCfg extends PIdxCfg> = Record<
	TIdxCfg['hashKey']['attribute'],
	IdxATLToType<TIdxCfg['hashKey']['type']>
> &
	(TIdxCfg['rangeKey'] extends IdxACfg
		? Record<TIdxCfg['rangeKey']['attribute'], IdxATLToType<TIdxCfg['rangeKey']['type']>>
		: {});

export type TIdxN<TIdxCfgM extends IdxCfgM> = string & keyof TIdxCfgM;

export type NotPIdxN<TPIdxN extends TIdxN<TIdxCfgM> & keyof TIdxCfgM, TIdxCfgM extends IdxCfgM<TPIdxN>> =
	| (string & Exclude<keyof TIdxCfgM, TPIdxN>)
	| never;

export interface MCfg {
	name: string;
	client: DocumentClient;
	logger?: ILogger;
}

interface TCfg<
	TPIdxN extends TIdxN<TIdxCfgM>,
	TIdxPA extends string,
	TIdxP extends IdxP<TIdxPA>,
	TIdxCfgM extends IdxCfgM<TPIdxN, string, IdxATL, TIdxPA, TIdxP>
> extends MCfg {
	primaryIndex: TPIdxN;
	indexes: TIdxCfgM;
}

export class Table<
	TPIdxN extends TIdxN<TIdxCfgM> = string,
	TIdxA extends string = string,
	TIdxATL extends IdxATL = IdxATL,
	TIdxPA extends string = string,
	TIdxP extends IdxP<TIdxPA> = IdxP<TIdxPA>,
	TIdxCfgM extends IdxCfgM<TPIdxN, TIdxA, TIdxATL, TIdxPA, TIdxP> = IdxCfgM<TPIdxN, TIdxA, TIdxATL, TIdxPA, TIdxP>
> {
	constructor(public config: TCfg<TPIdxN, TIdxPA, TIdxP, TIdxCfgM>) {
		this.DocumentClient = config.client;

		const { primaryIndex, indexes, ...methodConfig } = config;

		const { hashKey, rangeKey } = indexes[primaryIndex];

		this.ConstructProps = {
			partitionKey: {
				name: hashKey.attribute,
				type:
					hashKey.type === 'string'
						? AttributeType.STRING
						: hashKey.type === 'number'
						? AttributeType.NUMBER
						: AttributeType.STRING
			},
			sortKey: rangeKey
				? {
						name: rangeKey.attribute,
						type:
							rangeKey.type === 'string'
								? AttributeType.STRING
								: rangeKey.type === 'number'
								? AttributeType.NUMBER
								: AttributeType.STRING
				  }
				: undefined
		};

		this.put = putFn(methodConfig);
		this.get = getFn(methodConfig);
		this.create = createFn(methodConfig);
		this.update = updateFn(methodConfig);
		this.query = queryFn(methodConfig);
		this.scan = scanFn(methodConfig);
		this.delete = deleteFn(methodConfig);
		this.reset = resetFn(methodConfig, config.indexes[config.primaryIndex]);

		this.createSet = config.client.createSet;
		this.batchWrite = config.client.batchWrite;
		this.batchGet = config.client.batchGet;
		this.transactWrite = config.client.transactWrite;
		this.transactGet = config.client.transactGet;
	}

	DocumentClient: DocumentClient;
	ConstructProps: Pick<TableProps, 'partitionKey' | 'sortKey'>;

	Index!: TIdxN<TIdxCfgM>;
	IndexKeyM!: IdxCfgMToKeyM<TIdxCfgM>;

	PrimaryIndex!: TPIdxN;
	PrimaryIndexKey!: IdxKey<TIdxCfgM[TPIdxN]>;

	SecondaryIndex!: NotPIdxN<TPIdxN, TIdxCfgM>;
	SecondaryIndexKeyM!: {
		[x in NotPIdxN<TPIdxN, TIdxCfgM>]: IdxKey<TIdxCfgM[x]>;
	};

	put: ReturnType<typeof putFn<TPIdxN, TIdxCfgM>>;
	get: ReturnType<typeof getFn<TPIdxN, TIdxCfgM>>;
	create: ReturnType<typeof createFn<TPIdxN, TIdxCfgM>>;
	update: ReturnType<typeof updateFn<TPIdxN, TIdxCfgM>>;
	query: ReturnType<typeof queryFn<TPIdxN, TIdxCfgM>>;
	scan: ReturnType<typeof scanFn<TPIdxN, TIdxCfgM>>;
	delete: ReturnType<typeof deleteFn<TPIdxN, TIdxCfgM>>;
	reset: ReturnType<typeof resetFn<TIdxCfgM[TPIdxN]>>;

	createSet: DocumentClient['createSet'];
	batchWrite: DocumentClient['batchWrite'];
	batchGet: DocumentClient['batchGet'];
	transactWrite: DocumentClient['transactWrite'];
	transactGet: DocumentClient['transactGet'];

	get Item() {
		const ParentTable = this;

		return class TableItem<IA extends {} = {}, ISIdxN extends NotPIdxN<TPIdxN, TIdxCfgM> = never> extends Item<
			IA,
			ISIdxN,
			TPIdxN,
			TIdxA,
			TIdxATL,
			TIdxCfgM
		> {
			static createSet = ParentTable.config.client.createSet;

			constructor(
				props: IA,
				Item: IdxAFns<TIdxCfgM[ISIdxN | TPIdxN]> &
					ISIdxCfg<ISIdxN> &
					Constructor<Item<IA, ISIdxN, TPIdxN, TIdxA, TIdxATL, TIdxCfgM>>
			) {
				super(props, Item, ParentTable);
			}
		};
	}

	get getters() {
		return this.makeGetters();
	}

	makeGetters = () => {
		return getters<TPIdxN, TIdxA, TIdxATL, TIdxPA, TIdxP, TIdxCfgM>(this);
	};
}
