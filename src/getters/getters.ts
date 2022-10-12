import { Table, IdxCfgM, IdxATL, IdxACfg, IdxP, NotPIdxN, TIdxN } from '../Table/Table';
import { OA, zipObject } from '../utils';
import { IdxAFns, ISIdxCfg } from '../Item/Item';
import { indexGettersFn } from './indexGetters';
import { QueryInput } from '../Table/query';
import { all } from './all';

export type GetterQueryInput<
	TPIdxN extends TIdxN<TIdxCfgM>,
	TSIdxN extends NotPIdxN<TPIdxN, TIdxCfgM> | never,
	TIdxP extends IdxP<TIdxPA>,
	TIdxPA extends string,
	TIdxCfgM extends IdxCfgM<TPIdxN, string, IdxATL, TIdxPA, TIdxP>
> = Omit<
	OA<QueryInput<TPIdxN, TSIdxN, TIdxPA, TIdxP, TIdxCfgM>, 'KeyConditionExpression' | 'ExpressionAttributeValues'>,
	'IndexName'
>;

export type HKP<
	IdxN extends TIdxN<TIdxCfgM>,
	IIdxAFns extends IdxAFns<IdxN, TIdxCfgM>,
	TPIdxN extends TIdxN<TIdxCfgM> & keyof TIdxCfgM,
	TIdxCfgM extends IdxCfgM<TPIdxN>,
	HKPT = Parameters<IIdxAFns[TIdxCfgM[IdxN]['hashKey']['attribute']]>[0]
> = HKPT extends undefined ? void : HKPT;

export type RKP<
	IdxN extends TIdxN<TIdxCfgM>,
	IIdxAFns extends IdxAFns<IdxN, TIdxCfgM>,
	TPIdxN extends TIdxN<TIdxCfgM>,
	TIdxCfgM extends IdxCfgM<TPIdxN>,
	RKCfg = TIdxCfgM[IdxN]['rangeKey']
> = RKCfg extends IdxACfg<string, IdxATL>
	? Parameters<IIdxAFns[RKCfg['attribute']]>[0] extends undefined
		? void
		: Parameters<IIdxAFns[RKCfg['attribute']]>[0]
	: void;

export type HKRKP<
	IdxN extends TIdxN<TIdxCfgM>,
	IIdxAFns extends IdxAFns<IdxN, TIdxCfgM>,
	TPIdxN extends TIdxN<TIdxCfgM>,
	TIdxCfgM extends IdxCfgM<TPIdxN>,
	HKPT = HKP<IdxN, IIdxAFns, TPIdxN, TIdxCfgM>,
	RKPT = RKP<IdxN, IIdxAFns, TPIdxN, TIdxCfgM>
> = HKPT extends void ? (RKPT extends void ? void : RKPT) : RKPT extends void ? HKPT : HKPT & RKPT;

export const getters =
	<
		TPIdxN extends TIdxN<TIdxCfgM>,
		TIdxA extends string,
		TIdxATL extends IdxATL,
		TIdxPA extends string,
		TIdxP extends IdxP<TIdxPA>,
		TIdxCfgM extends IdxCfgM<TPIdxN, TIdxA, TIdxATL, TIdxPA, TIdxP>
	>(
		Table: Table<TPIdxN, TIdxA, TIdxATL, TIdxPA, TIdxP, TIdxCfgM>
	) =>
	<IA extends {}, ISIdxN extends NotPIdxN<TPIdxN, TIdxCfgM>, IIdxAFns extends IdxAFns<ISIdxN | TPIdxN, TIdxCfgM>>(
		Item: IIdxAFns & ISIdxCfg<ISIdxN>
	) => {
		const indexGetters = indexGettersFn<IA, ISIdxN, IIdxAFns, TPIdxN, TIdxA, TIdxATL, TIdxPA, TIdxP, TIdxCfgM>(
			Table,
			Item
		);

		const primaryOneGetter = indexGetters(Table.config.primaryIndex).one;

		const primaryIndexGetters = indexGetters(Table.config.primaryIndex);

		const secondaryIndexGetters: { [x in ISIdxN]: ReturnType<typeof indexGetters<x>> } = zipObject(
			Item.secondaryIndexes,
			Item.secondaryIndexes.map(index => indexGetters(index))
		);

		const gettersObject = Object.assign(primaryOneGetter, {
			all,
			...primaryIndexGetters,
			...secondaryIndexGetters
		});

		return gettersObject;
	};
