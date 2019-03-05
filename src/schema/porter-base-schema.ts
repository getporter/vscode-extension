import * as porter from '../porter/porter';
import { Errorable, map } from "../utils/errorable";
import { shell } from '../utils/shell';

export async function porterBaseSchema(): Promise<Errorable<JSONRootSchema>> {
    const schemaText = await porter.schema(shell);
    return map(schemaText, (text) => JSON.parse(text));
}
