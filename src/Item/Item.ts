import { zipObject } from '../utils';
import { Table, IdxATL, IdxKey, IdxCfgM, NotPIdxN, IdxKeys, TIdxN } from '../Table/Table';

export type IdxAFns<IdxN extends string & keyof TIdxCfgM, TIdxCfgM extends IdxCfgM> = {
	[x in keyof IdxKey<TIdxCfgM[IdxN]>]: (params: any) => IdxKey<TIdxCfgM[IdxN]>[x];
};

export interface ISIdxCfg<ISIdxN extends string> {
	secondaryIndexes: Array<ISIdxN>;
}

export class Item<
	IA extends {} = {},
	ISIdxN extends NotPIdxN<TPIdxN, TIdxCfgM> | never = never,
	TPIdxN extends TIdxN<TIdxCfgM> = string,
	TIdxA extends string = string,
	TIdxATL extends IdxATL = IdxATL,
	TIdxCfgM extends IdxCfgM<TPIdxN, TIdxA, TIdxATL> = IdxCfgM<TPIdxN, TIdxA, TIdxATL>
> {
	Table: Table<TPIdxN, TIdxA, TIdxATL, string, never, TIdxCfgM>;
	Item: IdxAFns<ISIdxN | TPIdxN, TIdxCfgM> & ISIdxCfg<ISIdxN>;

	Attributes!: IA;
	#initial: IA;
	#current: IA;

	constructor(
		props: IA,
		Item: IdxAFns<ISIdxN | TPIdxN, TIdxCfgM> & ISIdxCfg<ISIdxN>,
		Table: Table<TPIdxN, TIdxA, TIdxATL, string, never, TIdxCfgM>
	) {
		this.#initial = props;
		this.#current = props;

		this.Item = Item;
		this.Table = Table;

		this.onNew();
	}

	get key(): IdxKey<TIdxCfgM[TPIdxN]> {
		return this.indexKey(this.Table.config.primaryIndex);
	}

	indexKey<IdxN extends ISIdxN | TPIdxN>(index: IdxN): IdxKey<TIdxCfgM[IdxN]> {
		const { hashKey, rangeKey } = this.Table.config.indexes[index];

		const attributes = rangeKey ? [hashKey.attribute, rangeKey.attribute] : [hashKey.attribute];

		const values = attributes.map(attribute => this.Item[attribute](this.#current));

		return zipObject(attributes, values);
	}

	get indexKeys() {
		const keys = this.Item.secondaryIndexes.reduce((prev, cur) => ({ ...prev, ...this.indexKey(cur) }), {}) as IdxKeys<
			ISIdxN,
			TIdxCfgM
		>;

		return { ...keys, ...this.key };
	}

	get props() {
		return this.#current;
	}

	get propsWithKeys() {
		return { ...this.indexKeys, ...this.#current };
	}

	get init() {
		return this.#initial;
	}

	onNew() {}
	async onSet() {}
	async onWrite() {}
	async onCreate() {}
	async onDelete() {}

	async set(props: Partial<IA>) {
		await this.onSet();

		this.#current = { ...this.#current, ...props };

		if (this.Table.config.logger) this.Table.config.logger.info(this.#current);

		return;
	}

	async write() {
		await this.onWrite();

		await this.Table.put({
			Item: this.propsWithKeys
		});

		return this;
	}

	async create() {
		await this.onWrite();
		await this.onCreate();

		await this.Table.create({
			Key: this.key,
			Item: this.propsWithKeys
		});

		return this;
	}

	async update(props: Partial<IA>) {
		await this.set(props);

		let untrimmedUpdateExpression = 'SET ';
		let ExpressionAttributeValues = {};

		for (const key of Object.keys(props) as Array<keyof IA>) {
			untrimmedUpdateExpression += `${String(key)} = :${String(key)}, `;
			ExpressionAttributeValues = {
				...ExpressionAttributeValues,
				[`:${String(key)}`]: props[key]
			};
		}

		const UpdateExpression = untrimmedUpdateExpression.slice(0, untrimmedUpdateExpression.length - 2);

		await this.Table.update({
			Key: this.key,
			UpdateExpression,
			ExpressionAttributeValues
		});

		return this;
	}

	async delete() {
		await this.onDelete();

		await this.Table.delete({
			Key: this.key
		});

		return;
	}
}
