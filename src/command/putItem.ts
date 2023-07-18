import { AnyKeySpace } from '../KeySpace';
import { ReturnValue } from '@aws-sdk/client-dynamodb';
import {
	DxConditionExpressionParams,
	DxReturnParams,
	handleConditionExpressionParams,
	handleReturnParams,
	handleTableNameParam
} from '../util/InputParams';
import { GetReturnValuesOutput, getReturnValuesAttributes } from '../util/OutputParams';
import { executeMiddlewares, handleOutputMetricsMiddleware } from '../util/middleware';
import { PutCommand, PutCommandInput, PutCommandOutput } from '@aws-sdk/lib-dynamodb';
import { NativeAttributeValue } from '@aws-sdk/util-dynamodb';

export type DxPutItemReturnValues = Extract<ReturnValue, 'ALL_OLD' | 'NONE'> | undefined;

export interface DxPutItemInput<RV extends DxPutItemReturnValues = undefined>
	extends DxReturnParams<RV>,
		DxConditionExpressionParams {}

export interface DxPutCommandInput<
	Attributes extends Record<string, NativeAttributeValue> = Record<string, NativeAttributeValue>
> extends Omit<PutCommandInput, 'Item'> {
	Item: Attributes;
}

export type DxPutItemOutput<
	K extends AnyKeySpace = AnyKeySpace,
	RV extends DxPutItemReturnValues = undefined
> = GetReturnValuesOutput<K, RV>;

export interface DxPutCommandOutput<
	Attributes extends Record<string, NativeAttributeValue> = Record<string, NativeAttributeValue>
> extends Omit<PutCommandOutput, 'Attributes'> {
	Attributes?: Attributes;
}

export const dxPutItem = async <K extends AnyKeySpace = AnyKeySpace, RV extends DxPutItemReturnValues = undefined>(
	KeySpace: K,
	item: K['Attributes'],
	input?: DxPutItemInput<RV>
): Promise<DxPutItemOutput<K, RV>> => {
	const baseCommandInput: DxPutCommandInput<K['AttributesAndIndexKeys']> = {
		...handleTableNameParam(KeySpace.Table),
		Item: KeySpace.withIndexKeys(item),
		...handleConditionExpressionParams(input),
		...handleReturnParams(KeySpace, input)
	};

	const putCommandInput = await executeMiddlewares(
		['CommandInput', 'WriteCommandInput', 'PutCommandInput'],
		{ type: 'PutCommandInput', data: baseCommandInput },
		KeySpace.middleware
	).then(output => output.data);

	const putCommandOutput: DxPutCommandOutput<K['AttributesAndIndexKeys']> = await KeySpace.client.send(
		new PutCommand(putCommandInput)
	);

	const output = await executeMiddlewares(
		['CommandOutput', 'WriteCommandOutput', 'PutCommandOutput'],
		{ type: 'PutCommandOutput', data: putCommandOutput },
		KeySpace.middleware
	).then(output => output.data);

	await handleOutputMetricsMiddleware(output, KeySpace.middleware);

	const attributes = getReturnValuesAttributes(KeySpace, output.Attributes, input?.returnValues);

	return attributes;
};
