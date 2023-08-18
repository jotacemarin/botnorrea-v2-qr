import { randomUUID } from "crypto";
import {
  BAD_GATEWAY,
  BAD_REQUEST,
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
} from "http-status";
import { getCommand, putCommand, scanCommand, updateCommand } from "./dynamodb";

import { ChatTg, Group } from "../models";
import { buildExpressions } from "../utils/dynamoDbHelper";

const { DYNAMODB_TABLE_GROUPS } = process.env;
const tableGroups = `${DYNAMODB_TABLE_GROUPS}`;

class GroupsError extends Error {
  statusCode: number = INTERNAL_SERVER_ERROR;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = "GroupsError";
  }
}

const get = async (uuid: string | number): Promise<Group> => {
  const { Item } = await getCommand({ TableName: tableGroups, Key: { uuid } });
  return Item as Group;
};

const create = async (params: ChatTg) => {
  const timestamp = new Date().getTime();
  const uuid = randomUUID();
  const group: Group = {
    uuid,
    id: params?.id,
    title: params?.title,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await putCommand({ TableName: tableGroups, Item: group });
  return await get(uuid);
};

const update = async (params: Group): Promise<Group> => {
  if (!params?.uuid || !params?.id) {
    throw new GroupsError("Bad request", BAD_REQUEST);
  }

  const Item = await get(params?.uuid);
  if (!Item) {
    throw new GroupsError("Not found", NOT_FOUND);
  }

  if (!Item?.uuid) {
    throw new GroupsError("Bad gateway", BAD_GATEWAY);
  }

  const timestamp = new Date().getTime();
  const group: Group = {
    ...Item,
    title: params?.title,
    updatedAt: timestamp,
  };
  delete group?.uuid;

  const {
    ExpressionAttributeNames,
    ExpressionAttributeValues,
    UpdateExpression,
  } = buildExpressions(group);

  await updateCommand({
    TableName: tableGroups,
    Key: { uuid: Item?.uuid },
    ExpressionAttributeValues,
    UpdateExpression,
    ExpressionAttributeNames,
  });

  return await get(Item?.uuid);
};

const getById = async (id: string | number) => {
  return await scanCommand({
    TableName: tableGroups,
    ProjectionExpression: "#uuid, #id",
    ExpressionAttributeNames: {
      "#uuid": "uuid",
      "#id": "id",
    },
    ExpressionAttributeValues: {
      ":id": id,
    },
    FilterExpression: "id = :id",
  });
};

export default { get, create, update, getById };
