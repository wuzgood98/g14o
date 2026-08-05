import type {
  FlattenSchemaEvents,
  NestedSchemaShape,
  StandardSchemaV1,
} from "../src/schema/standard-schema";
import type { passThrough } from "../src/test-utils/schema";

type AlertSchema = ReturnType<
  typeof passThrough<{ body: string; title: string }>
>;

const nestedInput = {
  notification: {
    alert: {} as AlertSchema,
    info: {} as AlertSchema,
  },
} satisfies NestedSchemaShape;

type Flattened = FlattenSchemaEvents<typeof nestedInput>;

type AlertKey = "notification.alert" extends keyof Flattened ? true : false;
type AlertPayload = Flattened["notification.alert"];

const _keyCheck: AlertKey = true;
const _payloadCheck: AlertPayload = { title: "x", body: "y" };

declare const _schema: StandardSchemaV1;

type FlatLeaf = FlattenSchemaEvents<{
  "demo.ping": typeof _schema;
}>;

type PingKey = "demo.ping" extends keyof FlatLeaf ? true : false;
const _pingCheck: PingKey = true;
