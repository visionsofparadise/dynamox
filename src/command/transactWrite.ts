import { ConditionCheck, Delete, Put, TransactWriteItem, Update } from '@aws-sdk/client-dynamodb';
import { PrimaryIndex, Table } from '../Table';
import {
	DxConditionExpressionParams,
	DxReturnParams,
	DxUpdateExpressionParams,
	handleConditionExpressionParams,
	handleReturnValuesOnConditionCheckFailureParam,
	handleTableNameParam,
	handleUpdateExpressionParams
} from '../util/InputParams';
import { executeMiddlewares, handleOutputMetricsMiddleware } from '../util/middleware';
import { TransactWriteCommand, TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import { GenericAttributes } from '../Dx';

export interface DxTransactConditionRequest<T extends Table = Table> {
	condition: {
		key: T['IndexKeyMap'][PrimaryIndex];
	} & DxConditionExpressionParams &
		Pick<DxReturnParams, 'returnValuesOnConditionCheckFailure'>;
}

export interface DxTransactPutRequest<T extends Table = Table> {
	put: {
		item: T['AttributesAndIndexKeys'];
	} & DxConditionExpressionParams &
		Pick<DxReturnParams, 'returnValuesOnConditionCheckFailure'>;
}

export interface DxTransactUpdateRequest<T extends Table = Table> {
	update: {
		key: T['IndexKeyMap'][PrimaryIndex];
	} & DxUpdateExpressionParams &
		DxConditionExpressionParams &
		Pick<DxReturnParams, 'returnValuesOnConditionCheckFailure'>;
}

export interface DxTransactDeleteRequest<T extends Table = Table> {
	delete: {
		key: T['IndexKeyMap'][PrimaryIndex];
	} & DxConditionExpressionParams &
		Pick<DxReturnParams, 'returnValuesOnConditionCheckFailure'>;
}

export interface DxTransactWriteInput
	extends Pick<DxReturnParams, 'returnConsumedCapacity' | 'returnItemCollectionMetrics'> {
	clientRequestToken?: string;
}

export interface DxTransactWriteCommandInput<Attributes extends GenericAttributes = GenericAttributes>
	extends Omit<TransactWriteCommandInput, 'TransactItems'> {
	TransactItems:
		| (Omit<TransactWriteItem, 'ConditionCheck' | 'Put' | 'Delete' | 'Update'> & {
				ConditionCheck?: Omit<ConditionCheck, 'Key' | 'ExpressionAttributeValues'> & {
					Key: GenericAttributes | undefined;
					ExpressionAttributeValues?: GenericAttributes;
				};
				Put?: Omit<Put, 'Item' | 'ExpressionAttributeValues'> & {
					Item: Attributes;
					ExpressionAttributeValues?: GenericAttributes;
				};
				Delete?: Omit<Delete, 'Key' | 'ExpressionAttributeValues'> & {
					Key: GenericAttributes | undefined;
					ExpressionAttributeValues?: GenericAttributes;
				};
				Update?: Omit<Update, 'Key' | 'ExpressionAttributeValues'> & {
					Key: GenericAttributes | undefined;
					ExpressionAttributeValues?: GenericAttributes;
				};
		  })[]
		| undefined;
}

export type DxTransactWriteOutput = void;

export const dxTransactWrite = async <T extends Table = Table>(
	Table: T,
	requests: Array<
		DxTransactConditionRequest<T> | DxTransactPutRequest<T> | DxTransactUpdateRequest<T> | DxTransactDeleteRequest<T>
	>,
	input?: DxTransactWriteInput
): Promise<DxTransactWriteOutput> => {
	const baseCommandInput: DxTransactWriteCommandInput<T['AttributesAndIndexKeys']> = {
		TransactItems: requests.map(request => {
			if ('condition' in request) {
				return {
					ConditionCheck: {
						...handleTableNameParam(Table),
						Key: request.condition.key,
						...handleConditionExpressionParams(request.condition),
						...handleReturnValuesOnConditionCheckFailureParam(Table.defaults)
					}
				};
			}

			if ('put' in request) {
				return {
					Put: {
						...handleTableNameParam(Table),
						Item: request.put.item,
						...handleConditionExpressionParams(request.put),
						...handleReturnValuesOnConditionCheckFailureParam(Table.defaults)
					}
				};
			}

			if ('update' in request) {
				return {
					Update: {
						...handleTableNameParam(Table),
						Key: request.update.key,
						...handleUpdateExpressionParams(request.update),
						...handleConditionExpressionParams(request.update),
						...handleReturnValuesOnConditionCheckFailureParam(Table.defaults)
					}
				};
			}

			return {
				Delete: {
					...handleTableNameParam(Table),
					Key: request.delete.key,
					...handleConditionExpressionParams(request.delete),
					...handleReturnValuesOnConditionCheckFailureParam(Table.defaults)
				}
			};
		}),
		ReturnItemCollectionMetrics: input?.returnItemCollectionMetrics || Table.defaults?.returnItemCollectionMetrics,
		ReturnConsumedCapacity: input?.returnConsumedCapacity || Table.defaults?.returnConsumedCapacity
	};

	const transactWriteCommandInput = await executeMiddlewares(
		['CommandInput', 'WriteCommandInput', 'TransactWriteCommandInput'],
		{ type: 'TransactWriteCommandInput', data: baseCommandInput },
		Table.middleware
	).then(output => output.data);

	const transactWriteCommandOutput = await Table.client.send(new TransactWriteCommand(transactWriteCommandInput));

	const output = await executeMiddlewares(
		['CommandOutput', 'WriteCommandOutput', 'TransactWriteCommandOutput'],
		{ type: 'TransactWriteCommandOutput', data: transactWriteCommandOutput },
		Table.middleware
	).then(output => output.data);

	const { ItemCollectionMetrics, ConsumedCapacity } = output;

	await handleOutputMetricsMiddleware({ ItemCollectionMetrics, ConsumedCapacity }, Table.middleware);

	return;
};
