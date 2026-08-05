import { memoryStream } from "./memory";
import { describeStream } from "./stream-contract";

describeStream("memoryStream", () => memoryStream({ maxLength: 50 }));
